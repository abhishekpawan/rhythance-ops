import ReactDOM from 'react-dom/client'
import './cssOrder'
import App from './App.tsx'
import './styles/main.css'
import { reloadOnStaleChunk } from './utils/reloadOnStaleChunk'

reloadOnStaleChunk()

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
