import { resetDatabase } from '../db/reset.ts';

resetDatabase();
console.log('Reset complete: data/hostel.db and uploads/ restored to the seeded lab state.');
