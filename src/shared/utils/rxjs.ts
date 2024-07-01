import { Observable, Subject, finalize, mergeWith, takeUntil } from "rxjs";

/**
 * Merges two observables until the first one completes (or errors).
 * The difference between this and `merge` is that this will complete when the first observable completes,
 * while `merge` would only complete when _all_ observables complete.
 */
export function mergeUntilFirstComplete<FirstObsType, SecondObsType>(
  observable1: Observable<FirstObsType>,
  observable2: Observable<SecondObsType>,
): Observable<FirstObsType | SecondObsType> {
  const completionSubject = new Subject<void>();
  const observable1WithCompletion = observable1.pipe(
    takeUntil(completionSubject),
    finalize(() => completionSubject.next()),
  );
  const observable2WithCompletion = observable2.pipe(
    takeUntil(completionSubject),
    finalize(() => completionSubject.next()),
  );

  return observable1WithCompletion.pipe(mergeWith(observable2WithCompletion));
}
