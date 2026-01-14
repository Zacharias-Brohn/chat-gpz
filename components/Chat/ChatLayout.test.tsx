import { render, screen } from '@/test-utils';
import ChatLayout from './ChatLayout';

describe('ChatLayout', () => {
  it('renders chat interface', () => {
    render(<ChatLayout />);
    expect(screen.getByText('AI Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });
});
