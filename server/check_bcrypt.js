const bcrypt = require('bcryptjs');
const hash = '$2a$12$LJ3dBxUPMmICCvQGOKQzruIqLfL.mRJhS8G5BN.0bLJDXVlKGKfHm';
bcrypt.compare('password123', hash).then(res => console.log('Match:', res));
