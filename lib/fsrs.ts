import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

// One shared scheduler with default (well-tuned) FSRS-6 parameters.
const scheduler = fsrs();

// The ts-fsrs Card is stored verbatim as jsonb so we don't couple to its exact
// field set (it gained `learning_steps` in v5). Dates round-trip as ISO strings.
export type StoredCard = Record<string, unknown>;

export function newCardFields(): { fsrs: StoredCard; due: string } {
  const c = createEmptyCard();
  return { fsrs: c as unknown as StoredCard, due: c.due.toISOString() };
}

function hydrate(json: StoredCard | null | undefined): Card {
  const c = (json ? { ...json } : createEmptyCard()) as Card;
  c.due = new Date(c.due);
  c.last_review = c.last_review ? new Date(c.last_review) : undefined;
  return c;
}

// Advance a card by one review and return the new stored fields.
export function schedule(json: StoredCard | null | undefined, rating: Grade, now = new Date()): { fsrs: StoredCard; due: string } {
  const { card } = scheduler.next(hydrate(json), now, rating);
  return { fsrs: card as unknown as StoredCard, due: card.due.toISOString() };
}

export function isNewCard(json: StoredCard | null | undefined): boolean {
  return !json || (json.state as number) === State.New;
}

export { Rating, State };
