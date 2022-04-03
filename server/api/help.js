module.exports = function(req, res, userID, paths, searchParams) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('api docs');
  res.end();
};