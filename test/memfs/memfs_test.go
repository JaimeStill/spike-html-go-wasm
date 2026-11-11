//go:build js && wasm

// The runtime's in-memory fs, web/runtime/fs.ts, through package os: the Go test program
// scripts/check-go.sh runs under node with scripts/go-memfs-exec.sh as go test's -exec, which
// installs the fs in place of node's. TestMain refuses any other fs, so a run that fell back to
// node's fails rather than passing on it. Each test works under its own os.MkdirTemp directory.
package memfs_test

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"syscall"
	"testing"
	"time"
)

func TestMain(m *testing.M) {
	if got := os.Getenv("GOWASM_FS"); got != "memory" {
		_, _ = os.Stderr.WriteString("memfs: GOWASM_FS=" + got + "; run under scripts/go-memfs-exec.sh\n")
		os.Exit(1)
	}
	os.Exit(m.Run())
}

// dir is a fresh temporary directory, removed after the test.
func dir(t *testing.T) string {
	t.Helper()
	d, err := os.MkdirTemp("", "memfs-*")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	t.Cleanup(func() {
		if err := os.RemoveAll(d); err != nil {
			t.Errorf("RemoveAll(%s): %v", d, err)
		}
	})
	return d
}

func TestMkdirTempIsUnderTmp(t *testing.T) {
	d := dir(t)
	if filepath.Dir(d) != "/tmp" {
		t.Fatalf("MkdirTemp = %s, want a directory in /tmp", d)
	}
	info, err := os.Stat(d)
	if err != nil || !info.IsDir() {
		t.Fatalf("Stat(%s) = %v, %v; want a directory", d, info, err)
	}
}

func TestCreateWriteRead(t *testing.T) {
	name := filepath.Join(dir(t), "a.txt")
	if err := os.WriteFile(name, []byte("hello, memfs\n"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	got, err := os.ReadFile(name)
	if err != nil || string(got) != "hello, memfs\n" {
		t.Fatalf("ReadFile = %q, %v", got, err)
	}

	f, err := os.OpenFile(name, os.O_WRONLY|os.O_APPEND, 0)
	if err != nil {
		t.Fatalf("OpenFile append: %v", err)
	}
	if _, err := f.WriteString("more\n"); err != nil {
		t.Fatalf("append: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	if got, _ := os.ReadFile(name); string(got) != "hello, memfs\nmore\n" {
		t.Fatalf("after append = %q", got)
	}

	if err := os.WriteFile(name, []byte("short"), 0o644); err != nil {
		t.Fatalf("WriteFile truncating: %v", err)
	}
	if got, _ := os.ReadFile(name); string(got) != "short" {
		t.Fatalf("after O_TRUNC = %q, want %q", got, "short")
	}
}

func TestCreateExclusive(t *testing.T) {
	name := filepath.Join(dir(t), "x")
	f, err := os.OpenFile(name, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		t.Fatalf("first create: %v", err)
	}
	_ = f.Close()
	if _, err := os.OpenFile(name, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o600); !errors.Is(err, fs.ErrExist) {
		t.Fatalf("second create = %v, want ErrExist", err)
	}
}

func TestSeekAndPositional(t *testing.T) {
	f, err := os.Create(filepath.Join(dir(t), "seek"))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	defer func() { _ = f.Close() }()
	if _, err := f.WriteString("0123456789"); err != nil {
		t.Fatalf("Write: %v", err)
	}
	if pos, err := f.Seek(2, io.SeekStart); err != nil || pos != 2 {
		t.Fatalf("Seek start = %d, %v", pos, err)
	}
	buf := make([]byte, 3)
	if n, err := f.Read(buf); err != nil || string(buf[:n]) != "234" {
		t.Fatalf("Read after seek = %q, %v", buf[:n], err)
	}
	if pos, err := f.Seek(-2, io.SeekEnd); err != nil || pos != 8 {
		t.Fatalf("Seek end = %d, %v", pos, err)
	}
	if _, err := f.WriteString("ab"); err != nil {
		t.Fatalf("Write after seek: %v", err)
	}
	if _, err := f.WriteAt([]byte("Z"), 12); err != nil {
		t.Fatalf("WriteAt past the end: %v", err)
	}
	all := make([]byte, 20)
	n, err := f.ReadAt(all, 0)
	if !errors.Is(err, io.EOF) || string(all[:n]) != "01234567ab\x00\x00Z" {
		t.Fatalf("ReadAt = %q, %v; want the gap zero-filled and EOF", all[:n], err)
	}
	if err := f.Truncate(4); err != nil {
		t.Fatalf("Truncate: %v", err)
	}
	if info, err := f.Stat(); err != nil || info.Size() != 4 {
		t.Fatalf("Stat after Truncate = %v, %v", info, err)
	}
	if err := f.Sync(); err != nil {
		t.Fatalf("Sync: %v", err)
	}
}

func TestStat(t *testing.T) {
	d := dir(t)
	name := filepath.Join(d, "s")
	if err := os.WriteFile(name, []byte("12345"), 0o640); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	info, err := os.Stat(name)
	if err != nil {
		t.Fatalf("Stat: %v", err)
	}
	if info.Name() != "s" || info.Size() != 5 || info.IsDir() || info.Mode() != 0o640 {
		t.Fatalf("Stat = %s %d dir=%v %v", info.Name(), info.Size(), info.IsDir(), info.Mode())
	}
	if time.Since(info.ModTime()) > time.Minute {
		t.Fatalf("ModTime = %v, want now", info.ModTime())
	}
	if err := os.Chmod(name, 0o600); err != nil {
		t.Fatalf("Chmod: %v", err)
	}
	when := time.Date(2020, 1, 2, 3, 4, 5, 0, time.UTC)
	if err := os.Chtimes(name, when, when); err != nil {
		t.Fatalf("Chtimes: %v", err)
	}
	if info, _ := os.Lstat(name); info.Mode() != 0o600 || !info.ModTime().Equal(when) {
		t.Fatalf("Lstat after Chmod, Chtimes = %v %v", info.Mode(), info.ModTime())
	}
	if _, err := os.Stat(filepath.Join(d, "missing")); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("Stat missing = %v, want ErrNotExist", err)
	}
	if _, err := os.Stat(filepath.Join(name, "under")); !errors.Is(err, syscall.ENOTDIR) {
		t.Fatalf("Stat under a file = %v, want ENOTDIR", err)
	}
}

func TestReadDir(t *testing.T) {
	d := dir(t)
	for _, name := range []string{"c", "a", "b"} {
		if err := os.WriteFile(filepath.Join(d, name), nil, 0o644); err != nil {
			t.Fatalf("WriteFile: %v", err)
		}
	}
	if err := os.Mkdir(filepath.Join(d, "sub"), 0o755); err != nil {
		t.Fatalf("Mkdir: %v", err)
	}
	if err := os.Mkdir(filepath.Join(d, "sub"), 0o755); !errors.Is(err, fs.ErrExist) {
		t.Fatalf("Mkdir again = %v, want ErrExist", err)
	}
	entries, err := os.ReadDir(d)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	if !slices.Equal(names, []string{"a", "b", "c", "sub"}) || !entries[3].IsDir() {
		t.Fatalf("ReadDir = %v", names)
	}
	if err := os.MkdirAll(filepath.Join(d, "x/y/z"), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	var walked []string
	err = filepath.WalkDir(d, func(path string, _ fs.DirEntry, err error) error {
		walked = append(walked, path[len(d):])
		return err
	})
	want := []string{"", "/a", "/b", "/c", "/sub", "/x", "/x/y", "/x/y/z"}
	if err != nil || !slices.Equal(walked, want) {
		t.Fatalf("WalkDir = %v, %v", walked, err)
	}
}

func TestRename(t *testing.T) {
	d := dir(t)
	from, to := filepath.Join(d, "from"), filepath.Join(d, "to")
	if err := os.WriteFile(from, []byte("moved"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := os.WriteFile(to, []byte("replaced"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := os.Rename(from, to); err != nil {
		t.Fatalf("Rename: %v", err)
	}
	if got, err := os.ReadFile(to); err != nil || string(got) != "moved" {
		t.Fatalf("ReadFile(to) = %q, %v", got, err)
	}
	if _, err := os.Stat(from); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("Stat(from) = %v, want ErrNotExist", err)
	}

	sub := filepath.Join(d, "sub")
	if err := os.MkdirAll(filepath.Join(sub, "inner"), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.Rename(sub, filepath.Join(sub, "inner", "loop")); !errors.Is(err, syscall.EINVAL) {
		t.Fatalf("Rename into itself = %v, want EINVAL", err)
	}
	if err := os.Rename(sub, filepath.Join(d, "moved")); err != nil {
		t.Fatalf("Rename directory: %v", err)
	}
	if info, err := os.Stat(filepath.Join(d, "moved", "inner")); err != nil || !info.IsDir() {
		t.Fatalf("Stat moved/inner = %v, %v", info, err)
	}
}

func TestRemove(t *testing.T) {
	d := dir(t)
	sub := filepath.Join(d, "sub")
	name := filepath.Join(sub, "f")
	if err := os.Mkdir(sub, 0o755); err != nil {
		t.Fatalf("Mkdir: %v", err)
	}
	if err := os.WriteFile(name, []byte("x"), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := os.Remove(sub); !errors.Is(err, syscall.ENOTEMPTY) {
		t.Fatalf("Remove non-empty = %v, want ENOTEMPTY", err)
	}

	// An unlinked file stays readable through a descriptor already open on it.
	f, err := os.Open(name)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := os.Remove(name); err != nil {
		t.Fatalf("Remove file: %v", err)
	}
	if got, err := io.ReadAll(f); err != nil || string(got) != "x" {
		t.Fatalf("read after unlink = %q, %v", got, err)
	}
	_ = f.Close()
	if err := os.Remove(name); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("Remove again = %v, want ErrNotExist", err)
	}
	if err := os.Remove(sub); err != nil {
		t.Fatalf("Remove empty dir: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(d, "a/b/c"), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.RemoveAll(filepath.Join(d, "a")); err != nil {
		t.Fatalf("RemoveAll: %v", err)
	}
	if entries, err := os.ReadDir(d); err != nil || len(entries) != 0 {
		t.Fatalf("ReadDir after removals = %v, %v", entries, err)
	}
}

func TestGetwdChdir(t *testing.T) {
	d := dir(t)
	start, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(start) })
	if err := os.Chdir(d); err != nil {
		t.Fatalf("Chdir: %v", err)
	}
	if wd, err := os.Getwd(); err != nil || wd != d {
		t.Fatalf("Getwd = %q, %v; want %q", wd, err, d)
	}
	if err := os.WriteFile("rel", []byte("relative"), 0o644); err != nil {
		t.Fatalf("WriteFile relative: %v", err)
	}
	if got, err := os.ReadFile(filepath.Join(d, "rel")); err != nil || string(got) != "relative" {
		t.Fatalf("ReadFile absolute = %q, %v", got, err)
	}
	if err := os.Chdir(".."); err != nil {
		t.Fatalf("Chdir ..: %v", err)
	}
	if wd, _ := os.Getwd(); wd != "/tmp" {
		t.Fatalf("Getwd after .. = %q, want /tmp", wd)
	}
	if err := os.Chdir(filepath.Join(d, "missing")); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("Chdir missing = %v, want ErrNotExist", err)
	}
	if err := os.Chdir(filepath.Join(d, "rel")); !errors.Is(err, syscall.ENOTDIR) {
		t.Fatalf("Chdir to a file = %v, want ENOTDIR", err)
	}
}

func TestUnsupported(t *testing.T) {
	d := dir(t)
	name := filepath.Join(d, "f")
	if err := os.WriteFile(name, nil, 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if err := os.Symlink(name, filepath.Join(d, "l")); !errors.Is(err, syscall.ENOSYS) {
		t.Fatalf("Symlink = %v, want ENOSYS", err)
	}
	if err := os.Link(name, filepath.Join(d, "h")); !errors.Is(err, syscall.ENOSYS) {
		t.Fatalf("Link = %v, want ENOSYS", err)
	}
	if _, err := os.Readlink(name); !errors.Is(err, syscall.ENOSYS) {
		t.Fatalf("Readlink = %v, want ENOSYS", err)
	}
	if err := os.Chown(name, 0, 0); !errors.Is(err, syscall.ENOSYS) {
		t.Fatalf("Chown = %v, want ENOSYS", err)
	}
}
