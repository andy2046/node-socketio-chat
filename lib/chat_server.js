var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};
var roomsUsed = {};

exports.listen = function(server) {
	io = socketio.listen(server);
	io.set('log level', 1);
	io.sockets.on('connection', function (socket) {
		guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
		joinRoom(socket, 'Lobby');
		handleMessageBroadcasting(socket, nickNames);
		handleNameChangeAttempts(socket, nickNames, namesUsed);
		handleRoomJoining(socket);
		
		socket.on('rooms', function() {
			//console.log(io.sockets.manager.rooms);
			//console.log(io.sockets.manager.roomClients[socket.id]);
			socket.emit('rooms', roomsUsed[socket.id]); // io.sockets.manager.rooms); // io.sockets.adapter.rooms
		});
		
		handleClientDisconnection(socket, nickNames, namesUsed);
		
	});
};

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
	var name = 'Guest' + guestNumber;
	nickNames[socket.id] = name;
	socket.emit('nameResult', {
		success: true,
		name: name
	});
	namesUsed.push(name);
	return guestNumber + 1;
}

function joinRoom(socket, room) {
	socket.join(room);
	currentRoom[socket.id] = room;
	
	if (!!!roomsUsed[socket.id]) {roomsUsed[socket.id] = [];}
	if (roomsUsed[socket.id].indexOf(room) == -1) {
		roomsUsed[socket.id].push(room);
	}
	
	socket.emit('joinResult', {room: room});
	socket.broadcast.to(room).emit('message', {
		text: nickNames[socket.id] + ' has joined ' + room + '.'
	});
	
	var usersInRoom = io.sockets.clients(room); // io.of('/chat').in('general').clients

	if (usersInRoom.length > 1) {
		var usersInRoomSummary = 'Users currently in ' + room + ': ';
		for (var index in usersInRoom) {
			var userSocketId = usersInRoom[index].id;
			if (userSocketId != socket.id) {
				if (index > 0) {
					usersInRoomSummary += ', ';
				}
			usersInRoomSummary += nickNames[userSocketId];
			}
		}
		usersInRoomSummary += '.';
		socket.emit('message', {text: usersInRoomSummary});
	}
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
	socket.on('nameAttempt', function(name) {
	if (name.indexOf('Guest') == 0) {
		socket.emit('nameResult', {
			success: false,
			message: 'Names cannot begin with "Guest".'
		});
	} else {
		if (namesUsed.indexOf(name) == -1) {
			var previousName = nickNames[socket.id];
			var previousNameIndex = namesUsed.indexOf(previousName);
			namesUsed.push(name);
			nickNames[socket.id] = name;
			delete namesUsed[previousNameIndex];
			socket.emit('nameResult', {
				success: true,
				name: name
			});
			socket.broadcast.to(currentRoom[socket.id]).emit('message', {
				text: previousName + ' is now known as ' + name + '.'
			});
		} else {
			socket.emit('nameResult', {
				success: false,
				message: 'That name is already in use.'
			});
		}
	}
	});
}


function handleMessageBroadcasting(socket, nickNames) {
	socket.on('message', function (message) {
		socket.broadcast.to(message.room).emit('message', {
			text: nickNames[socket.id] + ': ' + message.text
		});
	});
}


function handleRoomJoining(socket) {
	socket.on('join', function(room1) {
		socket.broadcast.to(currentRoom[socket.id]).emit('message', { text: nickNames[socket.id] + ' has temporarily left ' + currentRoom[socket.id] + '.' });
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket, room1.newRoom);
	});
}


function handleClientDisconnection(socket) {
	socket.on('disconnect', function() {
		var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
		socket.broadcast.to(currentRoom[socket.id]).emit('message', { text: nickNames[socket.id] + ' has left ' + currentRoom[socket.id] + '.' });
		delete namesUsed[nameIndex];
		delete nickNames[socket.id];
		delete roomsUsed[socket.id];
	});
}


