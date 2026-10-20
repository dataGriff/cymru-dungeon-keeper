import { BESTIARY } from './data/bestiary';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = `Steward of Annwn — ${Object.keys(BESTIARY).length} entries in the bestiary.`;
}
