import { Observable } from "rxjs";
/**
 * Merges two observables until the first one completes (or errors).
 * The difference between this and `merge` is that this will complete when the first observable completes,
 * while `merge` would only complete when _all_ observables complete.
 */
export declare function mergeUntilFirstComplete<FirstObsType, SecondObsType>(observable1: Observable<FirstObsType>, observable2: Observable<SecondObsType>): Observable<FirstObsType | SecondObsType>;
