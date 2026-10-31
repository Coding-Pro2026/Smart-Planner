import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {clearAllPlanGenieData} from './lib/storage';
import './index.css';

// Top-level safety net: a render error anywhere still leaves the user with a
// working "reset" path instead of a blank page.
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary
    label="PlanGenie"
    offerDataReset
    onResetData={() => {
      clearAllPlanGenieData();
      window.location.reload();
    }}
  >
    <App />
  </ErrorBoundary>
);
