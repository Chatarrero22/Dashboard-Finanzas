import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ProveedorDialogos } from './Dialogos.jsx'
import './index.css'
import './pantallas.css'
import './shell.css'
import './resumen.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProveedorDialogos>
      <App />
    </ProveedorDialogos>
  </StrictMode>,
)
