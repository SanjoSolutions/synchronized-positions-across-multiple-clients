import './Chest.css'
import { noOperation } from 'shared/index.js'

export function Chest({ object, onClose }) {
  onClose = onClose || noOperation

  return (
    <div className="chest">
      <div className="chest__inner">
        { object.items.map((item, index) => <div key={index}>{item.amount} x {item.name}</div>) }
        <div style={{textAlign: 'right'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
