var C, CHARS, CHARS2IND, GET, K, L, SALT, aes_dec, aes_enc, arrayToBigInt, base64ToHex, blurAll, decrypt, elAdd, elTimes, encrypt, fromBaseKString, getID, getRandIntLBits, getY, hash, hexToBase64, i, id, input, k, l, len, makeCode, modsqrt, myFunction, neg, onCurve, out, param, pbkdf2, query, ref, ref1, ref2, runEncryption, toBaseKString, uu;

GET = {};

query = window.location.search.substring(1).split('&');

i = 0;

for (i = k = 0, ref = query.length; 0 <= ref ? k < ref : k > ref; i = 0 <= ref ? ++k : --k) {
  if (query[i] === '') {
    continue;
  }
  param = query[i].split('=');
  GET[decodeURIComponent(param[0])] = decodeURIComponent(param[1] || '');
}

if ("id" in GET) {
  document.getElementById("id").value = GET["id"];
  out = document.getElementById("out");
  out.innerHTML = "The ID has already been entered through the URL. Just enter a message to encrypt!";
  out.style.color = "green";
}

CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

CHARS2IND = {};

for (i = l = 0, ref1 = CHARS.length; 0 <= ref1 ? l < ref1 : l > ref1; i = 0 <= ref1 ? ++l : --l) {
  CHARS2IND[CHARS[i]] = i;
}

K = CHARS.length;

toBaseKString = function(n) {
  var qr, st;
  st = "";
  qr = n.divmod(K);
  st = CHARS[qr.remainder.value] + st;
  while (!qr.quotient.isZero()) {
    qr = qr.quotient.divmod(K);
    st = CHARS[qr.remainder.value] + st;
  }
  return st;
};

fromBaseKString = function(st) {
  var c, len, n, u;
  n = bigInt(0);
  for (u = 0, len = st.length; u < len; u++) {
    c = st[u];
    if (!(c in CHARS2IND)) {
      return -1;
    }
    n = n.times(K);
    n = n.plus(CHARS2IND[c]);
  }
  return n;
};

arrayToBigInt = function(arr) {
  var _, b, len, m, u, v;
  b = '';
  for (u = 0, len = arr.length; u < len; u++) {
    i = arr[u];
    m = 1;
    for (_ = v = 0; v < 32; _ = ++v) {
      if ((i & m) === 0) {
        b = b + '0';
      } else {
        b = b + '1';
      }
      m = m << 1;
    }
  }
  return bigInt(b, 2);
};

SALT = "f704a673366fe76fac7a50c55f62453eade6659661e0c58d4ee5726a7cd128fa";

pbkdf2 = function(input) {
  return arrayToBigInt(sjcl.misc.pbkdf2(input, SALT, 10000));
};

hash = pbkdf2;

L = 256;

neg = function(a, p) {
  a = bigInt(a);
  if (a.mod(p).isZero()) {
    return bigInt.zero;
  }
  return a.divide(p).plus(1).times(p).minus(a);
};

modsqrt = function(n, p) {
  var b, c, m, q, r, s, t, temp, z;
  n = bigInt(n);
  p = bigInt(p);
  if (!p.isPrime()) {
    return -1;
  }
  if (n.isZero()) {
    return bigInt(0);
  }
  if (!n.modPow(p.minus(1).divide(2), p).eq(1)) {
    return -1;
  }
  if (p.mod(4).eq(3)) {
    return n.modPow(p.plus(1).divide(4), p);
  }
  s = bigInt(0);
  q = p.minus(1);
  while (q.isEven()) {
    s = s.plus(1);
    q = q.shiftRight(1);
  }
  z = bigInt(Math.floor(p * Math.random()));
  while (z.isZero() || z.modPow(p.minus(1).divide(2), p).eq(1)) {
    z = bigInt(Math.floor(p * Math.random()));
  }
  m = s;
  c = z.modPow(q, p);
  t = n.modPow(q, p);
  r = n.modPow(q.plus(1).divide(2), p);
  while (true) {
    if (t.eq(0)) {
      return bigInt(0);
    }
    if (t.eq(1)) {
      return r;
    }
    i = bigInt(0);
    temp = t;
    while (!temp.eq(1)) {
      temp = temp.modPow(2, p);
      i = i.plus(1);
    }
    b = c.modPow(bigInt(1).shiftLeft(m.minus(i).minus(1).value), p);
    m = i;
    c = b.modPow(2, p);
    t = t.times(c).mod(p);
    r = r.times(b).mod(p);
  }
};

C = {
  P: bigInt(1).shiftLeft(255).minus(19),
  A: bigInt(486662),
  B: bigInt(1),
  G: [bigInt(9), bigInt("14781619447589544791020593568409986887264606134616475288964881837755586237401", 10)],
  Inf: "O"
};

getY = function(x, smallerRootQ) {
  var ref2, y1, y2;
  smallerRootQ = bigInt(smallerRootQ);
  y2 = x.modPow(3, C.P).plus(C.A.times(x.modPow(2, C.P))).plus(x).mod(C.P);
  y1 = modsqrt(y2, C.P);
  if (y1 === -1) {
    return -1;
  }
  y2 = neg(y1, C.P);
  if (y2.lesser(y1)) {
    ref2 = [y1, y2], y2 = ref2[0], y1 = ref2[1];
  }
  if (smallerRootQ.value === 1) {
    return y1;
  }
  return y2;
};

onCurve = function(p) {
  var lhs, rhs;
  lhs = C.B.times(p[1].modPow(2, C.P)).mod(C.P);
  rhs = p[0].modPow(3, C.P).plus(C.A.times(p[0].modPow(2, C.P))).plus(p[0]).mod(C.P);
  return lhs.eq(rhs);
};

elAdd = function(p1, p2) {
  var temp, x, y;
  if (p1 === C.Inf) {
    return p2;
  }
  if (p2 === C.Inf) {
    return p1;
  }
  if (!(onCurve(p1) && onCurve(p2))) {
    return -1;
  }
  p1 = [p1[0].mod(C.P), p1[1].mod(C.P)];
  p2 = [p2[0].mod(C.P), p2[1].mod(C.P)];
  if (p1[0].eq(p2[0])) {
    if (p1[1].plus(p2[1]).mod(C.P).isZero()) {
      return C.Inf;
    }
    x = p1[0].modPow(2, C.P).plus(neg(1, C.P)).modPow(2, C.P).times(p1[1].modPow(2, C.P).times(4).times(C.B).modInv(C.P)).mod(C.P);
    temp = p1[0].modPow(2, C.P).times(3).plus(C.A.times(2).times(p1[0])).plus(1).mod(C.P).times(C.B.times(p1[1]).times(2).modInv(C.P)).mod(C.P);
    y = p1[0].times(3).plus(C.A).times(temp).plus(neg(C.B.times(temp.modPow(3, C.P)), C.P)).plus(neg(p1[1], C.P));
  } else {
    x = C.B.times(p2[0].times(p1[1]).plus(neg(p1[0].times(p2[1]), C.P)).modPow(2, C.P)).times(p1[0].times(p2[0]).times(p2[0].plus(neg(p1[0], C.P)).modPow(2, C.P)).modInv(C.P)).mod(C.P);
    y = p1[0].times(2).plus(p2[0]).plus(C.A).times(p2[1].plus(neg(p1[1], C.P))).times(p2[0].plus(neg(p1[0], C.P)).modInv(C.P)).mod(C.P).plus(neg(C.B.times(p2[1].plus(neg(p1[1], C.P)).modPow(3, C.P)).times(p2[0].plus(neg(p1[0], C.P)).modPow(3, C.P).modInv(C.P)), C.P)).plus(neg(p1[1], C.P)).mod(C.P);
  }
  return [x, y];
};

elTimes = function(p, n) {
  var dub, res;
  n = bigInt(n);
  res = C.Inf;
  dub = p;
  while (!n.isZero()) {
    if (n.and(1).eq(1)) {
      res = elAdd(res, dub);
    }
    dub = elAdd(dub, dub);
    n = n.shiftRight(1);
  }
  return res;
};

getRandIntLBits = function() {
  var byte, bytes, len, n, u;
  n = bigInt(0);
  bytes = window.crypto.getRandomValues(new Uint8Array(L / 8));
  for (u = 0, len = bytes.length; u < len; u++) {
    byte = bytes[u];
    n = n.shiftLeft(8).plus(byte);
  }
  return n;
};

base64ToHex = function(base64) {
  var HEX, _hex, raw, ref2, u;
  raw = atob(base64);
  HEX = '';
  for (i = u = 0, ref2 = raw.length; 0 <= ref2 ? u < ref2 : u > ref2; i = 0 <= ref2 ? ++u : --u) {
    _hex = raw.charCodeAt(i).toString(16);
    HEX += _hex.length === 2 ? _hex : '0' + _hex;
  }
  return HEX.toUpperCase();
};

hexToBase64 = function(hexstring) {
  return btoa(hexstring.match(/\w{2}/g).map(function(a) {
    return String.fromCharCode(parseInt(a, 16));
  }).join(''));
};

aes_enc = function(pass, data) {
  var ct, encoded, iv, slt, x;
  encoded = sjcl.encrypt(pass, data, {
    mode: 'gcm'
  });
  eval('e = ' + encoded);
  ct = bigInt(base64ToHex(e.ct), 16);
  iv = bigInt(base64ToHex(e.iv), 16);
  slt = bigInt(base64ToHex(e.salt), 16);
  x = ct.shiftLeft(128).plus(iv).shiftLeft(64).plus(slt);
  return x;
};

aes_dec = function(pass, x) {
  var ct, data, encoded, err, iv, o, slt;
  o = bigInt(1);
  slt = hexToBase64(x.mod(o.shiftLeft(64)).toString(16));
  iv = hexToBase64(x.shiftRight(64).mod(o.shiftLeft(128)).toString(16));
  ct = hexToBase64(x.shiftRight(64 + 128).toString(16));
  encoded = "{\"iv\":\"" + iv + "\",\"v\":1,\"iter\":10000,\"ks\":128,\"ts\":64,\"mode\":\"gcm\",\"adata\":\"\",\"cipher\":\"aes\",\"salt\":\"" + slt + "\",\"ct\":\"" + ct + "\"}";
  try {
    data = sjcl.decrypt(pass, encoded);
  } catch (_error) {
    err = _error;
    data = -1;
  }
  return data;
};

getID = function(pass) {
  var a, id, key, smallerRootQ;
  a = hash(pass);
  while (a.geq(C.P) || a.leq(1)) {
    pass = pass + "extra";
    a = hash(pass);
  }
  key = elTimes(C.G, a);
  if (key[1].lesser(neg(key[1], C.P))) {
    smallerRootQ = 1;
  } else {
    smallerRootQ = 0;
  }
  id = key[0].shiftLeft(1).plus(smallerRootQ);
  return id;
};

encrypt = function(mess, id) {
  var B, b, e, encrypted, key, keyx, keyy, pass, r, sharedKey, smallerRootQ;
  smallerRootQ = id.and(1);
  keyx = id.shiftRight(1);
  keyy = getY(keyx, smallerRootQ);
  if (keyy === -1) {
    return -1;
  }
  key = [keyx, keyy];
  if (!onCurve(key)) {
    return -1;
  }
  r = getRandIntLBits();
  b = hash(mess + r.toString(2));
  while (b.geq(C.P) || b.leq(1)) {
    r = getRandIntLBits();
    b = hash(mess + r.toString(2));
  }
  B = elTimes(C.G, b);
  if (B[1].lesser(neg(B[1], C.P))) {
    smallerRootQ = 1;
  } else {
    smallerRootQ = 0;
  }
  id = B[0].shiftLeft(1).plus(smallerRootQ);
  sharedKey = elTimes(key, b);
  sharedKey = sharedKey[0].shiftLeft(L).plus(sharedKey[1]);
  pass = toBaseKString(sharedKey);
  e = aes_enc(pass, mess);
  encrypted = e.shiftLeft(L + 1).plus(id);
  return encrypted;
};

decrypt = function(pass, encrypted) {
  var B, Bx, By, a, e, id, mess, o, sharedKey, smallerRootQ;
  a = hash(pass);
  while (a.geq(C.P) || a.leq(1)) {
    pass = pass + "extra";
    a = hash(pass);
  }
  o = bigInt(1);
  id = encrypted.mod(o.shiftLeft(L + 1));
  e = encrypted.shiftRight(L + 1);
  smallerRootQ = id.and(1);
  Bx = id.shiftRight(1);
  By = getY(Bx, smallerRootQ);
  if (By === -1) {
    return -1;
  }
  B = [Bx, By];
  if (!onCurve(B)) {
    return -1;
  }
  sharedKey = elTimes(B, a);
  sharedKey = sharedKey[0].shiftLeft(L).plus(sharedKey[1]);
  pass = toBaseKString(sharedKey);
  mess = aes_dec(pass, e);
  return mess;
};

makeCode = function(text) {
  var qrcode;
  document.getElementById('qrcode').innerHTML = '';
  if (!text) {
    document.getElementById('idqr').innerHTML = '';
    return;
  }
  document.getElementById('idqr').innerHTML = 'ID (QR code):';
  qrcode = new QRCode('qrcode', {
    width: 128,
    height: 128,
    correctLevel: QRCode.CorrectLevel.M
  });
  qrcode.makeCode(text);
};

myFunction = function() {
  out = document.getElementById("out");
  out.innerHTML = "Working...";
  out.style.color = 'blue';
  out.scrollIntoView(false);
  setTimeout(runEncryption, 40);
};

runEncryption = function() {
  var col, eString, enc, encrypted, id, idString, mess, output, pass, scrollToOut;
  mess = document.getElementById('mess').value;
  id = document.getElementById('id').value;
  enc = document.getElementById('enc').value;
  pass = document.getElementById('pass').value;
  makeCode();
  if (pass.length !== 0) {
    document.getElementById('mess').value = "";
    if (enc.length === 0) {
      id = getID(pass);
      idString = toBaseKString(id);
      document.getElementById('id').value = idString;
      output = "Success! Here's your ID! Send it to anyone so they can encrypt messages that only you can decrypt. Or send them <a href='https://www.chausies.xyz/encrypt?id=" + idString + "'>this url</a>.";
      col = "green";
      makeCode('https://www.chausies.xyz/encrypt?id=' + idString);
    } else {
      encrypted = fromBaseKString(enc);
      if (encrypted === -1) {
        mess = "";
      } else {
        mess = decrypt(pass, encrypted);
      }
      if (mess === -1) {
        output = "Error! The Password doesn't match the Encrypted Message.";
        col = "red";
      } else {
        document.getElementById('mess').value = mess;
        output = "Success! The Encrypted Message has been decrypted!";
        col = "green";
      }
    }
  } else {
    if (id.length === 0) {
      if (mess.length === 0) {
        output = "Error! Nothing entered. Please either enter a Password to get your ID, an ID+Message to get an Encrypted Message, or an Encrypted Message+Password to get the original Message.";
      } else {
        output = "Error! Please enter the ID of the person for whom the Message is being encryted.";
      }
      col = "red";
    } else {
      if (mess.length === 0) {
        output = "Error! Please enter a Message to encrypt";
        col = "red";
      } else {
        id = fromBaseKString(id);
        if (id !== -1) {
          encrypted = encrypt(mess, id);
        }
        if ((id === -1) || (encrypted === -1)) {
          output = "Error! ID was probably invalid";
          col = "red";
        } else {
          eString = toBaseKString(encrypted);
          document.getElementById('enc').value = eString;
          output = "Success! Send over the Encrypted Message to the other party.";
          col = "green";
        }
      }
    }
  }
  out = document.getElementById("out");
  out.innerHTML = output;
  out.style.color = col;
  scrollToOut = function() {
    out.scrollIntoView(false);
  };
  setTimeout(scrollToOut, 200);
};

blurAll = function() {
  var tmp;
  tmp = document.createElement("input");
  document.body.appendChild(tmp);
  tmp.focus();
  document.body.removeChild(tmp);
};

ref2 = ['pass', 'id', 'enc'];
for (uu = 0, len = ref2.length; uu < len; uu++) {
  id = ref2[uu];
  input = document.getElementById(id);
  input.addEventListener('keydown', function(event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      blurAll();
      myFunction();
    }
  });
}

(function() {
  var areas, clicked, fn, ref3, v;
  areas = document.querySelectorAll('.highlight');
  clicked = Array(areas.length).fill(false);
  fn = function() {
    var area, j;
    j = i;
    area = areas[j];
    area.addEventListener('click', function() {
      if (!clicked[j]) {
        area.select();
        clicked[j] = true;
      }
    });
    return area.addEventListener('blur', function() {
      clicked[j] = false;
    });
  };
  for (i = v = 0, ref3 = areas.length; 0 <= ref3 ? v < ref3 : v > ref3; i = 0 <= ref3 ? ++v : --v) {
    fn();
  }
})();

// ---
// generated by coffee-script 1.9.2
