type ActivityFunction<P extends Serializable[], R extends Serializable> = (
  ...parameters: P
) => R;

type Serializable =
  | string
  | number
  | boolean
  | null
  | Serializable[]
  | { [key: string]: Serializable };
