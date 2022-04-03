let helpStr = `
endpoints marked with a * require authentication
authentication: use basic authorization header, or store header value as cookie called "loginToken", retrieved from wss://hostname/

POST /api/user/logout *

POST /api/user/signup
send as form data, contained named fields "json_payload" and "avatar"
"json_payload" should contain "username" (2-32 bytes as a string), "password" (string), and "interests" (number represented by a string)
"avatar" should be a jpeg image

GET /api/user/data[/id] [*]
either send id in path, or the current user will be used
returns the data in json

POST /api/user/data *
see signup, except fields are all optional

DELETE /api/user/delete *
deletes user
`;
helpStr = helpStr.trim();

module.exports = function(req, res, paths, searchParams) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write(helpStr);
  res.end();

  return 0;
};