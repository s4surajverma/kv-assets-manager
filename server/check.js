require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL_LOCAL });
client.connect().then(() => 
  client.query("SELECT tgname FROM pg_trigger WHERE tgrelid = 'vidyalaya'::regclass").then(v => {
    console.log('TRIGGERS ON VIDYALAYA:', v.rows);
  })
).then(res => {
  console.log('Result:', res.rows);
}).catch(err => {
  console.error(err);
}).finally(() => client.end());
