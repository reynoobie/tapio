import {DndContext,KeyboardSensor,PointerSensor,TouchSensor,closestCenter,useSensor,useSensors} from '@dnd-kit/core'
import {SortableContext,sortableKeyboardCoordinates,useSortable,verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVertical} from 'lucide-react'
export function SortBlocks({ids,move,children}){
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(TouchSensor,{activationConstraint:{delay:180,tolerance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}))
 return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over})=>{if(over)move(ids.indexOf(active.id),ids.indexOf(over.id))}}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext></DndContext>
}
export function SortBlock({id,title,children}){
 const {attributes,listeners,setNodeRef,transform,transition}=useSortable({id})
 return <div ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} className="sort-block"><button type="button" className="icon sort-grip" {...attributes} {...listeners} aria-label={'Drag '+title}><GripVertical size={18}/></button>{children}</div>
}
