/* Sincronització privada amb correu i contrasenya, com l'app de Factures Marta. */
(() => {
  const storageKey = 'diari-kombutxa-v3';
  const firebaseConfig = {
    apiKey: 'AIzaSyAdVKCuMwIqSegBrkEzNjAhNXVOkt6y_Y8',
    authDomain: 'diari-kombutxa-marta.firebaseapp.com',
    databaseURL: 'https://diari-kombutxa-marta-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'diari-kombutxa-marta',
    storageBucket: 'diari-kombutxa-marta.firebasestorage.app',
    messagingSenderId: '1080420629513',
    appId: '1:1080420629513:web:89e8dc133c40ae00284cd8'
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const database = firebase.database();
  const loginScreen = document.querySelector('#login-screen');
  const loginForm = document.querySelector('#login-form');
  const loginEmail = document.querySelector('#login-email');
  const loginPassword = document.querySelector('#login-password');
  const loginError = document.querySelector('#login-error');
  const loginButton = document.querySelector('#login-submit');
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
  const showLogin = () => {
    loginScreen.classList.remove('is-hidden');
    loginPassword.value = '';
    loginError.textContent = '';
    setTimeout(() => loginEmail.focus(), 0);
  };
  const hideLogin = () => loginScreen.classList.add('is-hidden');
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

  window.kombutxaCloud = { save(data) { return writeCloud(data); } };

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginError.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Entrant…';
    try {
      await auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value);
    } catch (error) {
      console.error(error);
      const messages = {
        'auth/invalid-email': 'El correu no és vàlid.',
        'auth/user-not-found': 'Aquest usuari no existeix.',
        'auth/wrong-password': 'La contrasenya no és correcta.',
        'auth/invalid-credential': 'El correu o la contrasenya no són correctes.',
        'auth/too-many-requests': 'Hi ha massa intents. Torna-ho a provar més tard.'
      };
      loginError.textContent = messages[error.code] || 'No s’ha pogut iniciar la sessió.';
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Entrar';
    }
  });
  authButton.addEventListener('click', () => auth.signOut());

  auth.onAuthStateChanged(user => {
    if (dataRef) dataRef.off();
    dataRef = null;
    currentUser = user;
    if (!user) {
      showLogin();
      return;
    }
    hideLogin();
    setStatus(`Connectada com ${user.email}. Preparant la sincronització…`);
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
      setStatus('La base de dades no dona accés. Revisa les regles de seguretat.', 'error');
    });
  });
})();

