package main

import (
	"cmp"
	"slices"
	"sync"
)

// A pipeline is a chain of stages, each a goroutine that receives values from one channel and
// sends what it makes of them down another, closing that channel when its input is done. Here
// generate starts each chain, square works over it, merge joins the chains into one channel, and
// collect gathers what comes out, in order.

// A result is a number and its square.
type result struct {
	n, square int
}

// generate answers a channel that receives each of nums, then is closed.
func generate(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for _, n := range nums {
			out <- n
		}
	}()
	return out
}

// square answers a channel that receives each number from in with its square, then is closed once
// in is.
func square(in <-chan int) <-chan result {
	out := make(chan result)
	go func() {
		defer close(out)
		for n := range in {
			out <- result{n, n * n}
		}
	}()
	return out
}

// merge answers one channel that receives every value from each of ins, in whatever order they
// come, and is closed once all of them are: a WaitGroup counts the goroutines still copying, and
// one more goroutine waits on it to close the channel.
func merge(ins ...<-chan result) <-chan result {
	out := make(chan result)
	var wg sync.WaitGroup
	for _, in := range ins {
		wg.Go(func() {
			for r := range in {
				out <- r
			}
		})
	}
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

// collect receives every value from in until it's closed, and answers them ordered by number, so
// the order the stages ran in doesn't show.
func collect(in <-chan result) []result {
	var results []result
	for r := range in {
		results = append(results, r)
	}
	slices.SortFunc(results, func(a, b result) int { return cmp.Compare(a.n, b.n) })
	return results
}
