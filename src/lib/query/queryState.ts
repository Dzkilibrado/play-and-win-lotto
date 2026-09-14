export interface QueryStateInput<T> {
  data: T | undefined;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
}

export type QueryState = "loading" | "error" | "success";

/** Nunca permite que ausência provisória de dados seja interpretada como vazio confirmado. */
export function resolveQueryState<T>(query: QueryStateInput<T>): QueryState {
  if (query.isPending || (query.isFetching && query.data === undefined)) return "loading";
  if (query.isError) return "error";
  return "success";
}
