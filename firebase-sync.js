/* Accés amb rols: MARTA administra; la resta consulta i compra. */
(() => {
  const storageKey = 'diari-kombutxa-v3';
  const adminUid = '9WNBWF1ss4XBjnbNaJzPkkSm5MY2';
  const firebaseConfig = {
    apiKey: 'AIzaSyAdVKCuMwIqSegBrkEzNjAhNXVOkt6y_Y8', authDomain: 'diari-kombutxa-marta.firebaseapp.com',
    databaseURL: 'https://diari-kombutxa-marta-default-rtdb.europe-west1.firebasedatabase.app', projectId: 'diari-kombutxa-marta',
    storageBucket: 'diari-kombutxa-marta.firebasestorage.app', messagingSenderId: '1080420629513', appId: '1:1080420629513:web:89e8dc133c40ae00284cd8'
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth(), database = firebase.database();
  const loginScreen = document.querySelector('#login-screen'), loginForm = document.querySelector('#login-form'), registerForm = document.querySelector('#register-form');
  const loginEmail = document.querySelector('#login-email'), loginPassword = document.querySelector('#login-password'), loginError = document.querySelector('#login-error'), loginButton = document.querySelector('#login-submit');
  const registerName = document.querySelector('#register-name'), registerEmail = document.querySelector('#register-email'), registerPassword = document.querySelector('#register-password'), registerError = document.querySelector('#register-error'), registerButton = document.querySelector('#register-submit');
  const status = document.querySelector('#cloud-status'), bar = document.querySelector('.cloud-bar'), authButton = document.querySelector('#auth-button');
  let diaryRef = null, publicRef = null, usersRef = null, ordersRef = null, currentUser = null, currentRole = null;
  const localData = () => { try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } };
  const setStatus = (message, state = '') => { status.textContent = message; bar.classList.toggle('is-synced', state === 'synced'); bar.classList.toggle('is-error', state === 'error'); };
  const showLogin = () => { loginScreen.classList.remove('is-hidden'); loginForm.hidden = false; registerForm.hidden = true; loginPassword.value = ''; loginError.textContent = ''; };
  const showRegister = () => { loginForm.hidden = true; registerForm.hidden = false; registerPassword.value = ''; registerError.textContent = ''; setTimeout(() => registerName.focus(), 0); };
  const hideLogin = () => loginScreen.classList.add('is-hidden');
  const emitRole = role => window.dispatchEvent(new CustomEvent('kombutxa-role-change', { detail: { role } }));
  const withoutUndefined = record => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
  const publicDiary = data => ({
    f1: [],
    f2: (data.f2 || []).map(({ id, name, date, liters, days, components, ingredients, notes, photos }) => withoutUndefined({ id, name, date, liters, days, components, ingredients, notes, photos })),
    f3: (data.f3 || []).map(({ id, f2Id, date, liters, bottles, status, bestBefore, notes, photos }) => withoutUndefined({ id, f2Id, date, liters, bottles, status, bestBefore, notes, photos })),
    updatedAt: data.updatedAt || Date.now(), sharedImport2026: true
  });
  const writeCloud = async data => {
    if (!diaryRef || currentRole !== 'admin' || !data) return;
    try { setStatus('S’estan sincronitzant les dades…'); await diaryRef.set({ data, updatedAt: data.updatedAt || Date.now() }); await publicRef.set({ data: publicDiary(data), updatedAt: data.updatedAt || Date.now() }); setStatus('Dades sincronitzades.', 'synced'); }
    catch (error) { console.error(error); setStatus('No s’han pogut sincronitzar.', 'error'); }
  };
  const releaseListeners = () => { if (diaryRef) diaryRef.off(); if (publicRef) publicRef.off(); if (usersRef) usersRef.off(); if (ordersRef) ordersRef.off(); diaryRef = null; publicRef = null; usersRef = null; ordersRef = null; };
  const registerViewerProfile = async user => {
    const ref = database.ref(`registeredUsers/${user.uid}`), snapshot = await ref.once('value');
    if (!snapshot.exists()) await ref.set({ name: user.displayName || '', email: user.email || '', role: 'viewer', registeredAt: firebase.database.ServerValue.TIMESTAMP });
  };
  const listenDiary = role => {
    diaryRef = database.ref(`users/${adminUid}/diari`); publicRef = database.ref('publicDiary');
    const source = role === 'admin' ? diaryRef : publicRef;
    source.on('value', snapshot => {
      const remote = snapshot.val(), local = localData();
      if (!remote?.data) { if (role === 'admin') writeCloud(local); return; }
      if (role === 'admin' && local?.updatedAt && local.updatedAt > (remote.updatedAt || 0)) { writeCloud(local); return; }
      if (role === 'admin') publicRef.set({ data: publicDiary(remote.data), updatedAt: remote.updatedAt || Date.now() }).catch(error => console.error(error));
      localStorage.setItem(storageKey, JSON.stringify(remote.data));
      window.dispatchEvent(new CustomEvent('kombutxa-cloud-data'));
      setStatus(role === 'admin' ? 'Dades sincronitzades.' : 'Mode consulta.', 'synced');
    }, error => { console.error(error); setStatus('No tens accés a les dades.', 'error'); });
  };
  const listenUsers = () => {
    usersRef = database.ref('registeredUsers');
    usersRef.on('value', snapshot => {
      const users = Object.entries(snapshot.val() || {}).map(([uid, user]) => ({ uid, ...user })).sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
      window.dispatchEvent(new CustomEvent('kombutxa-users-change', { detail: { users } }));
    });
  };
  const listenOrders = () => {
    ordersRef = database.ref('orders');
    ordersRef.on('value', snapshot => {
      const orders = Object.entries(snapshot.val() || {}).flatMap(([userId, userOrders]) => Object.entries(userOrders || {}).map(([id, order]) => ({ id, userId, ...order }))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      window.dispatchEvent(new CustomEvent('kombutxa-orders-change', { detail: { orders } }));
    });
  };
  window.kombutxaCloud = { save: writeCloud };
  window.kombutxaOrders = { async place(order) {
    if (!currentUser || currentRole !== 'viewer') throw new Error('Inicia sessió amb un compte de consulta.');
    if (!order.f3Id || !Number.isInteger(order.quantity) || order.quantity < 1) throw new Error('Selecciona un producte i el nombre d’ampolles.');
    await database.ref(`orders/${currentUser.uid}`).push({ ...order, status: 'pending', createdAt: firebase.database.ServerValue.TIMESTAMP, email: currentUser.email || '' });
  }, async update(order, status) {
    if (currentRole !== 'admin') throw new Error('Només l’administradora pot gestionar sol·licituds.');
    if (status === 'confirmed') {
      let stockAvailable = true;
      const result = await diaryRef.transaction(current => {
        const data = current?.data, requested = Number(order.quantity || 0), item = data?.f3?.find(entry => entry.id === order.f3Id);
        if (!item || (item.status || 'stock') === 'consumed' || Number(item.bottles || 0) < requested) { stockAvailable = false; return; }
        const next = { ...data, f3: data.f3.map(entry => entry.id === order.f3Id ? { ...entry, bottles: String(Number(entry.bottles) - requested) } : entry), updatedAt: Date.now() };
        return { ...current, data: next, updatedAt: next.updatedAt };
      });
      if (!result.committed || !stockAvailable) throw new Error('No hi ha prou ampolles en estoc per confirmar aquesta sol·licitud.');
    }
    await database.ref(`orders/${order.userId}/${order.id}`).update({ status, managedAt: firebase.database.ServerValue.TIMESTAMP });
  } };
  document.querySelector('#show-register').onclick = showRegister;
  document.querySelector('#show-login').onclick = showLogin;
  loginForm.addEventListener('submit', async event => {
    event.preventDefault(); loginError.textContent = ''; loginButton.disabled = true; loginButton.textContent = 'Entrant…';
    try { await auth.signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value); }
    catch (error) { loginError.textContent = 'El correu o la contrasenya no són correctes.'; }
    finally { loginButton.disabled = false; loginButton.textContent = 'Entrar'; }
  });
  registerForm.addEventListener('submit', async event => {
    event.preventDefault(); registerError.textContent = ''; registerButton.disabled = true; registerButton.textContent = 'Creant…';
    try {
      const credential = await auth.createUserWithEmailAndPassword(registerEmail.value.trim(), registerPassword.value);
      await credential.user.updateProfile({ displayName: registerName.value.trim() });
    } catch (error) {
      const messages = { 'auth/email-already-in-use': 'Aquest correu ja té un compte.', 'auth/invalid-email': 'El correu no és vàlid.', 'auth/weak-password': 'La contrasenya ha de tenir almenys 6 caràcters.' };
      registerError.textContent = messages[error.code] || 'No s’ha pogut crear el compte.';
    } finally { registerButton.disabled = false; registerButton.textContent = 'Crear compte'; }
  });
  authButton.addEventListener('click', () => auth.signOut());
  auth.onAuthStateChanged(async user => {
    releaseListeners(); currentUser = user; currentRole = null;
    if (!user) { showLogin(); return; }
    const role = user.uid === adminUid ? 'admin' : 'viewer'; currentRole = role;
    try {
      if (role === 'viewer') await registerViewerProfile(user);
      hideLogin(); emitRole(role); setStatus(role === 'admin' ? 'Mode administradora.' : 'Mode consulta.', 'synced');
      listenDiary(role); if (role === 'admin') { listenUsers(); listenOrders(); }
    } catch (error) { console.error(error); showLogin(); loginError.textContent = 'No s’ha pogut configurar l’accés.'; }
  });
})();
