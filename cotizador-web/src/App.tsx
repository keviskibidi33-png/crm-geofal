import { QuoteBuilderPage } from './pages/QuoteBuilderPage';
import { QuotesListPage } from './pages/QuotesListPage';

export default function App() {
  const path = window.location.pathname;
  
  if (path === '/quotes' || path === '/list') {
    return <QuotesListPage />;
  }
  
  return <QuoteBuilderPage />;
}
