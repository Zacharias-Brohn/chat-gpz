import { render, screen } from '@/test-utils';
import ChatLayout from './ChatLayout';

describe('ChatLayout', () => {
  it('renders chat interface', () => {
    render(<ChatLayout />);
    expect(screen.getByText('ChatGPZ')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });
});
