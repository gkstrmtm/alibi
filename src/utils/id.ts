import { v4 as uuidv4 } from 'uuid';

export function makeId(_prefix: string) {
  return uuidv4();
}
