# How to add goal-seek strategies

We have generalised the `goalSeek` routine so you can reuse it for any gaol where you're 
hunting for highest value of one varying value, such that a projection is affordable.

You can look at the `goalSeek` call hierarchy for real-world examples. Here's a quick tour.

`goalSeek()` takes four parameters:
  + a `ScoreTester` function. This takes a score, uses it to make a projection, and returns
    a TestedTarget for that projection.

  + a TestedTarget for the minumum score
  + a TestedTarget for the maximum score
  + precision - a number

### "Score"

A *score* is a generalisation, representing the value you want to vary. It is always a 
`number` , and it is always higher-is-better.

### TestedTarget

A `TestedTarget` is the outcome of a projection for a given score. Most importantly, it
contains the `isAffordable` boolean, because we are hunting for the highest score such that
`isAffordable == true` .

It also contains elements of the projection outcome that the caller will want to use.

### ScoreTester

`ScoreTester` is the type `(score: number) => TestedTarget` . A goal type will implement
its own polymorphic `ScoreTester` which fits this type.

`goalSeek` will invoke the `ScoreTester` multiple times, looking for the highest score
that is affordable, within the precision

So, any specific goal implementation needs its own specialised `ScoreTester` which converts
a score into a projection payload, and performs that projection.

You would typically implement the `ScoreTester` as a higher-order function taking properties
common to all projections, and returning a function that takes `score` :

```
const fooScoreTester = (projectionParameters: TargetPotProjectionParameters) => {
  return (score: number) => {
      const payload = preparePayload(projectionParameters, score);
      const projection = targetPotProjection(payload);
      return { score, ...rest of tested target }
  }
};
```

If the varying property is not already a number, it will need complementary routines to 
convert a score into a number and back.

 - for `maximum-sustainable-income` the conversion is simply `(score) => score` since
`annualTargetAmount` is already a number, and higher is better.
 - for `earliest-retirement`

    - it's not enough to use `(score) => FIXED_DATE.addMonths(score)`

  because this would make later dates better. 
    - We could use `FIXED_DATE.addMonths(-score)` (the code is fine with negative scores)
    - In reality we use `endOfLife.addMonths(-score)` because it's helpful while debugging
      to see and intuitive number "how much time in retirement?"

You have the option of falsifying min- and max- `TestedTarget` -- which is why `goalSeek` takes them as parameters --  but the safest thing is to decide on lowest possible or highest
possible score, and execute your `ScoreTester` to get an accurate `TestedTarget` for those scores.

## Orchestration

We don't force goal-types to use `goalSeek()` , so you'll explicitly write a routine which
calls it. The pattern is to have  a function in `goal-types/foo/index.ts` which prepares
a `ScoreTester` using `fooScoreTester` , creates min- and max- targets, and passes these
to `goalSeek` .

Then a level higher, make `getParallelGoalTypes` call the new goal type's orchestrator.

`getParallelGoalTypes` will probably need to convert the `score` in the response it receives
into the property it wants to return.

## Summary

To implement a new `Foo` goal seek:

 - write a score-to-foo conversion function
 - write a `fooScoreTester()` using your conversion function
 - write routines to identify max and min scores, use `fooScoreTester()` to get `TestedTarget` s
   for these
 - write a `seekFoo()` orchestration function which prepares the FooScoreTester, max and min 
   and invokes `goalSeek()`

 - update the root goal-types `index.ts` to call your new `seekFoo()`

 - in the same `index.ts` , if needed, translate the `score` into the property you need, for
   presentation
