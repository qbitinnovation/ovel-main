import { getDevStore } from '../lib/dev-store';

console.log(JSON.stringify(getDevStore().users, null, 2));
