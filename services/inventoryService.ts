import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export const addInventoryItem = async (item: any) => {
  await addDoc(collection(db, "inventory"), item);
};

export const subscribeInventory = (callback: Function) => {
  return onSnapshot(collection(db, "inventory"), (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(data);
  });
};