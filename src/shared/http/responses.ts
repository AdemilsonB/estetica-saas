export function created<TData>(data: TData) {
  return Response.json(data, { status: 201 });
}
