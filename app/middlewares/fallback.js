module.exports = {
  notFound: async (ctx) => {
    ctx.throw(404, `Resource Not Found`)
  },
  methodNotAllowed: async (ctx) => {
    ctx.throw(405, `Method '${ctx.request.method}' Not Allowed`)
  },
  notImplemented: async (ctx) => {
    ctx.throw(501, `API Not Implemented Yet`)
  }
}
