const bcrypt = require('bcryptjs');
bcrypt.hash('test1234', 12).then(hash => console.log('Hash:', hash));
