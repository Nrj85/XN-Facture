import { redirect } from 'next/navigation';

// La landing page arrivera en phase 6 ; la racine mène pour l'instant à
// l'application.
export default function Home() {
  redirect('/dashboard');
}
