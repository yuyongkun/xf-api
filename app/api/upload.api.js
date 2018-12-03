module.exports.handleUploadRequest = async (ctx) => {
  const file = ctx.request.body.files.file
  const filename = file.path.substring(file.path.lastIndexOf('/'))
  ctx.body = {
    data: { url: `/uploaded-files${filename}` }
  }
}