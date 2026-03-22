import env from 'dotenv';
import Server from './server/Server';
env.config();
const server = new Server();