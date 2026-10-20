import { useCallback, useRef, useState } from 'react';
import type { EditorDocument } from '../shared/types';

export function useDocument(initial:EditorDocument) {
  const [doc,setDoc]=useState(initial),[version,setVersion]=useState(0);
  const current=useRef(initial),past=useRef<EditorDocument[]>([]),future=useRef<EditorDocument[]>([]);
  const commit=useCallback((next:EditorDocument)=>{if(next===current.current)return;past.current.push(current.current);future.current=[];current.current=next;setDoc(next);setVersion(v=>v+1)},[]);
  const undo=useCallback(()=>{const previous=past.current.pop();if(!previous)return;future.current.push(current.current);current.current=previous;setDoc(previous);setVersion(v=>v+1)},[]);
  const redo=useCallback(()=>{const next=future.current.pop();if(!next)return;past.current.push(current.current);current.current=next;setDoc(next);setVersion(v=>v+1)},[]);
  return {doc,commit,undo,redo,canUndo:past.current.length>0,canRedo:future.current.length>0,version};
}
