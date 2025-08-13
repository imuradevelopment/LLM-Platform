import 'dotenv/config';
import { createApp } from './app';

const portRaw = process.env.PORT;
if (!portRaw) throw new Error('Missing required env: PORT');
const PORT = Number(portRaw);
if (Number.isNaN(PORT)) throw new Error(`Env PORT must be a number. Got: ${portRaw}`);

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`BE listening on http://localhost:${PORT}`);
});


