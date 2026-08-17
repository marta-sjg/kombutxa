/* Firebase is used only after Marta signs in with her Google account. */
(() => {
  const storageKey = 'diari-kombutxa-v3';
  const firebaseConfig = {
    apiKey: 'AIzaSyAdVKCuMwIqSegBrkEzNjAhNXVOkt6y_Y8',
    authDomain: 'diari-kombutxa-marta.firebaseapp.com',
    databaseURL: 'https://diari-kombutxa-marta-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'diari-kombutxa-marta',
    storageBucket: 'diari-kombutxa-marta.firebasestorage.app',
    messagingSenderId: '1080420629513',
    appId: '1:1080420629513:web:89e8dc133c40ae00284cd8',
    measurementId: 'G-ZJT8J0W41T'
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const database = firebase.database();
  const status = document.querySelector('#cloud-status');
  const bar = document.querySelector('.cloud-bar');
  const authButton = document.querySelector('#auth-button');
  let dataRef = null;
  let currentUser = null;

  const localData = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
    catch { return null; }
  };
  const setStatus = (message, state = '') => {
    status.textContent = message;
    bar.classList.toggle('is-synced', state === 'synced');
    bar.classList.toggle('is-error', state === 'error');
  };
  const writeCloud = async data => {
    if (!dataRef || !data) return;
    try {
      setStatus('S’estan sincronitzant les dades…');
      await dataRef.set({ data, updatedAt: data.updatedAt || Date.now() });
      setStatus('Dades sincronitzades amb el teu compte.', 'synced');
    } catch (error) {
      console.error(error);
      setStatus('No s’han pogut sincronitzar; es mantenen desades en aquest dispositiu.', 'error');
    }
  };

  window.kombutxaCloud = {
    save(data) { return writeCloud(data); }
  };

  authButton.addEventListener('click', async () => {
    if (currentUser) { await auth.signOut(); return; }
    try {
      setStatus('S’està obrint l’accés de Google…');
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch (error) {
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
      } else {
        console.error(error);
        setStatus('No s’ha pogut iniciar sessió. Torna-ho a provar.', 'error');
      }
    }
  });

  auth.onAuthStateChanged(user => {
    if (dataRef) dataRef.off();
    dataRef = null;
    currentUser = user;
    if (!user) {
      authButton.textContent = 'Inicia sessió amb Google';
      setStatus('Les dades es desen en aquest dispositiu.');
      return;
    }
    authButton.textContent = 'Tanca sessió';
    setStatus(`Connectada com ${user.displayName || user.email}. Preparant la sincronització…`);
    dataRef = database.ref(`users/${user.uid}/diari`);
    dataRef.on('value', snapshot => {
      const remote = snapshot.val();
      const local = localData();
      if (!remote?.data) {
        writeCloud(local);
        return;
      }
      const remoteData = remote.data;
      if (local?.updatedAt && local.updatedAt > (remote.updatedAt || 0)) {
        writeCloud(local);
        return;
      }
      localStorage.setItem(storageKey, JSON.stringify(remoteData));
      window.dispatchEvent(new CustomEvent('kombutxa-cloud-data'));
      setStatus('Dades sincronitzades amb el teu compte.', 'synced');
    }, error => {
      console.error(error);
      setStatus('La base de dades encara no dona accés. Cal afegir les regles de seguretat.', 'error');
    });
  });
})();

