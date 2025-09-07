export const badRequest = (msg) => Response.json({ error: msg }, { status: 400 });
export const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401 });
export const forbidden = () => Response.json({ error: 'forbidden' }, { status: 403 });
export const ok = (data) => Response.json(data, { status: 200 });
export const created = (data) => Response.json(data, { status: 201 });
export const serverError = (e) => {
  console.error(e);
  return Response.json({ error: 'server_error' }, { status: 500 });
};
