import type { ChatMessage } from './chatTypes'

export const keyExtractor = (item: ChatMessage) => String(item.id);
