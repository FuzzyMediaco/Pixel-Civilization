const signIn = document.querySelector("#sign-in");
const remove = document.querySelector("#remove");
const status = document.querySelector("#status");
let account;
async function api(path, method = "GET", data) {
  const response = await fetch("/api/account/" + path, {
    method, credentials:"same-origin",
    headers:{"Content-Type":"application/json",...(account ? {"X-Game-Account":account.id} : {})},
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "The request could not be completed.");
  return result;
}
async function refresh() {
  try {
    account = (await api("me")).user;
    signIn.hidden = Boolean(account);
    remove.hidden = !account;
    document.querySelector("#who").textContent = account?.email || "";
    status.textContent = account ? "Check that this is the account you want to remove." : "Sign in to the account you want to remove.";
  } catch { status.textContent = "Connect to the game service and reload this page to manage your account."; }
}
signIn.onsubmit = async event => {
  event.preventDefault();
  const button = signIn.querySelector("button");
  button.disabled = true;
  try { await api("login","POST",Object.fromEntries(new FormData(signIn))); signIn.reset(); await refresh(); }
  catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
};
remove.onsubmit = async event => {
  event.preventDefault();
  if (!account || !remove.elements.confirm.checked) return;
  const button = remove.querySelector("button");
  button.disabled = true;
  try {
    await api("me","DELETE",{password:remove.elements.password.value});
    account = null; remove.reset(); remove.hidden = true;
    status.textContent = "Your Pixel Civilization account and cloud islands have been deleted.";
  } catch (error) { status.textContent = error.message; button.disabled = false; }
};
void refresh();
