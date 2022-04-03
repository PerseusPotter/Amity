let helpStr = `
endpoints marked with a * require authentication
authentication: use basic authorization header, or store header value as cookie called "loginToken", retrieved from wss://hostname/

POST /api/user/logout *

POST /api/user/signup
send as form data, containing named fields "json_payload" and "avatar"
"json_payload" should contain "username" (2-32 bytes as a string), "password" (string), and "interests" (number represented by a string)
"avatar" should be a jpeg image

GET /api/user/data[/<id>] [*]
either send id in path, or the current user will be used
returns the data in json

POST /api/user/data *
see signup, except fields are all optional

DELETE /api/user/delete *
deletes user

GET /api/user/servers *
gets the servers the user is currently in

POST /api/user/servers/<id> *
joins a server by id

GET /api/server/data/id [*]
if the server is not publicly visible, you must authenticate that you are in said server
return the data in json

SET /api/server/data/id *
send as form data, containing named fields "json_payload" and "icon"
"json_payload" could contain "name" (2-32 bytes as a string), "owner" (id of the new owner, represented by the string), "interests" (number represented by a string), or "visibility" (boolean)
"icon" should be a jpeg image (if provided)

POST /api/server/leave/id *
leave the server

POST /api/server/channels/new *
the body should contain a string (2-32 characters long) representing the name of the channel

GET /api/server/similar/<interests>
returns a JSON array of objects containing a servers "id", "similar" interests, and similar interests "count"

GET /api/channel/<serverID>/<channelID>[/<messageID>] *
get the previous 50 messages
if messageID is provided, it will be relative to that message
otherwise the latest 50 messages will be send
returns json

POST /api/channel/<serverID>/<channelID> *
send as form data, containing named fields "json_payload" and "attachment"
"json_payload" should contain "content" (1-2000 bytes as a string)
"attachment" is an optional file attached to the message

GET /api/files/<filename>
gets a file
`;
helpStr = helpStr.trim();

module.exports = function(req, res, paths, searchParams) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write(helpStr);
  res.end();

  return -1;
};