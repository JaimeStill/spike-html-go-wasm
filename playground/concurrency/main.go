// Command concurrency tours Go's concurrency: goroutines, functions that run alongside the rest of
// the program; channels, which pass values from one goroutine to another and make one wait for
// the other; select, which waits on several channels at once; a sync.WaitGroup, which waits for a
// group of goroutines to finish; and a pipeline, stages joined by channels, in pipeline.go.
//
// Under GOOS=js, as here in the browser, GOMAXPROCS is 1: the goroutines take turns on one thread
// rather than run in parallel, though each behaves as it would anywhere. Whatever order they take
// their turns in, the program prints the same lines on every run, since no line depends on that
// order: each result goes in its own place and is printed once all are in, or comes over a
// channel whose sends and receives fix the order themselves.
package main

import (
	"fmt"
	"sync"
	"time"
)

func main() {
	// A WaitGroup's Go starts a goroutine and counts it; Wait returns once every one has finished.
	// Each goroutine writes only its own element of lengths, so none gets in another's way.
	words := []string{"goroutine", "channel", "select", "pipeline"}
	lengths := make([]int, len(words))
	var wg sync.WaitGroup
	for i, w := range words {
		wg.Go(func() { lengths[i] = len(w) })
	}
	wg.Wait()
	fmt.Println("Goroutines, one per word, then Wait:")
	for i, w := range words {
		fmt.Printf("  %-10s %d letters\n", w, lengths[i])
	}

	// An unbuffered channel hands a value straight from sender to receiver, each waiting for the
	// other, so the two goroutines here, main and the doubler, take strict turns.
	ping, pong := make(chan int), make(chan int)
	go func() {
		defer close(pong)
		for n := range ping {
			pong <- 2 * n
		}
	}()
	fmt.Println("\nChannels, taking turns:")
	for n := 1; n <= 3; n++ {
		ping <- n
		fmt.Printf("  sent %d, got back %d\n", n, <-pong)
	}
	close(ping)

	fmt.Println("\nSelect:")
	// With a default case, select doesn't wait: nothing is ready, so default runs.
	empty := make(chan string)
	select {
	case s := <-empty:
		fmt.Println("  received", s)
	default:
		fmt.Println("  nothing ready, so the default case ran")
	}

	// time.After answers a channel that receives once the time is up, so a select on it and on a
	// channel nothing sends to gives up after 10ms rather than wait forever.
	never := make(chan string)
	select {
	case s := <-never:
		fmt.Println("  received", s)
	case <-time.After(10 * time.Millisecond):
		fmt.Println("  nothing came within 10ms, so the timeout case ran")
	}

	// Select takes from whichever of two channels is ready, in whatever order the senders run, so
	// the totals, not the order, are what it prints. generate is pipeline.go's.
	evens, odds := tally(generate(2, 4, 6, 8), generate(1, 3, 5))
	fmt.Printf("  from evens: %d values, sum %d\n", evens.count, evens.sum)
	fmt.Printf("  from odds:  %d values, sum %d\n", odds.count, odds.sum)

	fmt.Println("\nA pipeline, squared by three workers:")
	results := collect(merge(square(generate(1, 2, 3, 4, 5, 6)), square(generate(7, 8)),
		square(generate(9, 10))))
	total := 0
	for _, r := range results {
		fmt.Printf("  %2d squared is %3d\n", r.n, r.square)
		total += r.square
	}
	fmt.Println("  total", total)
}

// count is a running count and sum of the values received from one channel.
type count struct {
	count, sum int
}

// tally receives from a and b, whichever is ready, until both are closed, and answers each one's
// count and sum. A closed channel is set to nil, since a nil channel is never ready, so select stops
// choosing it.
func tally(a, b <-chan int) (fromA, fromB count) {
	for a != nil || b != nil {
		select {
		case v, ok := <-a:
			if !ok {
				a = nil
				continue
			}
			fromA.count++
			fromA.sum += v
		case v, ok := <-b:
			if !ok {
				b = nil
				continue
			}
			fromB.count++
			fromB.sum += v
		}
	}
	return fromA, fromB
}
