var C, L, base64urlChars, base64urlToBin, binToBase64url, blurAll, charsToBinary, elAdd, elTimes, getRandIntNBits, getY, hash, i, id, input, l, len, makeCode, modsqrt, myFunction, neg, o, onCurve, ref, ref1, runVerification, sha, signMessage, st, verifySig,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

base64urlChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_";

charsToBinary = {};

for (i = l = 0, ref = base64urlChars.length; 0 <= ref ? l < ref : l > ref; i = 0 <= ref ? ++l : --l) {
  st = i.toString(2);
  st = "000000".substr(st.length) + st;
  charsToBinary[base64urlChars[i]] = st;
}

sha = function(input) {
  return bigInt(CryptoJS.SHA3(input).toString(), 16).shiftRight(256);
};

hash = sha;

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
  N: bigInt(1).shiftLeft(252).plus("27742317777372353535851937790883648493"),
  Inf: "O"
};

getY = function(x, smallerRootQ) {
  var ref1, y1, y2;
  smallerRootQ = bigInt(smallerRootQ);
  y2 = x.modPow(3, C.P).plus(C.A.times(x.modPow(2, C.P))).plus(x).mod(C.P);
  y1 = modsqrt(y2, C.P);
  if (y1 === -1) {
    return -1;
  }
  y2 = neg(y1, C.P);
  if (y2.lesser(y1)) {
    ref1 = [y1, y2], y2 = ref1[0], y1 = ref1[1];
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

getRandIntNBits = function() {
  var byte, bytes, len, n, o;
  n = bigInt(0);
  bytes = window.crypto.getRandomValues(new Uint8Array(N / 8));
  for (o = 0, len = bytes.length; o < len; o++) {
    byte = bytes[o];
    n = n.shiftLeft(8).plus(byte);
  }
  return n;
};

base64urlToBin = function(base64url) {
  var bin, char, len, o;
  bin = '';
  for (o = 0, len = base64url.length; o < len; o++) {
    char = base64url[o];
    if (!(indexOf.call(base64urlChars, char) >= 0)) {
      return null;
    }
    bin = bin + charsToBinary[char];
  }
  return bin;
};

binToBase64url = function(bin) {
  var base64url;
  base64url = '';
  i = bin.length - 6;
  while (i > 0) {
    base64url = base64urlChars[parseInt(bin.slice(i, i + 6), 2)] + base64url;
    i -= 6;
  }
  base64url = base64urlChars[parseInt(bin.slice(0, i + 6), 2)] + base64url;
  return base64url;
};

signMessage = function(mess, pass) {
  var d, done, id, k, p, phrase, q, r, s, sig, smallerRootQ, z;
  z = hash(mess);
  d = hash(pass);
  while (d.geq(C.N) || d.leq(1)) {
    pass = pass + "extra";
    d = hash(pass);
  }
  q = elTimes(C.G, d);
  if (q[1].lesser(neg(q[1], C.P))) {
    smallerRootQ = 1;
  } else {
    smallerRootQ = 0;
  }
  id = q[0].shiftLeft(1).plus(smallerRootQ);
  phrase = mess + pass;
  done = false;
  while (!done) {
    phrase = phrase + 'extra';
    k = hash(phrase);
    if (k.greater(1) && k.lesser(C.N)) {
      p = elTimes(C.G, k);
      r = p[0].mod(C.N);
      if (r.greater(0)) {
        s = z.plus(r.times(d)).times(k.modInv(C.N)).mod(C.N);
        if (s.greater(0)) {
          sig = r.shiftLeft(L).plus(s);
          done = true;
        }
      }
    }
  }
  return [id, sig];
};

verifySig = function(mess, id, sig) {
  var p, q, qx, qy, r, s, smallerRootQ, u1, u2, verified, w, x, z;
  if ((id === null) || (sig === null)) {
    return false;
  }
  id = bigInt(id, 2);
  qx = id.shiftRight(1);
  smallerRootQ = id.and(1);
  qy = getY(qx, smallerRootQ);
  if (qy === -1) {
    return false;
  }
  q = [qx, qy];
  if (!onCurve(q)) {
    return false;
  }
  if (!(elTimes(q, C.N) === C.Inf)) {
    return false;
  }
  z = hash(mess);
  sig = bigInt(sig, 2);
  r = sig.shiftRight(L);
  s = sig.minus(r.shiftLeft(L));
  verified = false;
  if (r.greater(0) && r.lesser(C.N) && s.greater(0) && s.lesser(C.N)) {
    w = s.modInv(C.N);
    u1 = z.times(w).mod(C.N);
    u2 = r.times(w).mod(C.N);
    p = elAdd(elTimes(C.G, u1), elTimes(q, u2));
    if (p !== C.Inf) {
      x = p[0].mod(C.N);
      if (r.eq(x)) {
        verified = true;
      }
    }
  }
  return verified;
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
    width: 100,
    height: 100,
    correctLevel: QRCode.CorrectLevel.M
  });
  qrcode.makeCode(text);
};

myFunction = function() {
  var out;
  out = document.getElementById("out");
  out.innerHTML = "Working...";
  out.style.color = 'blue';
  out.scrollIntoView(false);
  setTimeout(runVerification, 20);
};

runVerification = function() {
  var col, id, idString, mess, out, output, pass, ref1, scrollToOut, sig, verified;
  mess = document.getElementById('mess').value;
  id = document.getElementById('id').value;
  sig = document.getElementById('sig').value;
  pass = document.getElementById('pass').value;
  makeCode();
  if (mess.length === 0) {
    mess = "";
  }
  if (pass.length !== 0) {
    ref1 = signMessage(mess, pass), id = ref1[0], sig = ref1[1];
    idString = binToBase64url(id.toString(2));
    document.getElementById('id').value = idString;
    makeCode(idString);
    if (mess === "") {
      output = "Success! Here's the unique ID corresponding to your Password.";
      document.getElementById('sig').value = "";
    } else {
      output = "Success! Send the message, along with the Signature+ID so they can verify the message is indeed from you.";
      document.getElementById('sig').value = binToBase64url(sig.toString(2));
    }
    col = "green";
  } else if (id.length > 0 && sig.length > 0) {
    verified = verifySig(mess, base64urlToBin(id), base64urlToBin(sig));
    if (verified) {
      output = "Verification SUCCESS! The signature does indeed match the message from this ID. The other party used the correct password for their ID.";
      col = "green";
    } else {
      output = "Verification FAILED! The signature doesn't match the message from this ID. The other party didn't use the correct password for their ID.";
      col = "red";
    }
  } else {
    output = "Error! Please either enter a Password to get your ID, a Message+Password to generate a Signature, or enter a Message+ID+Signature to verify a Signature.";
    col = "orange";
  }
  out = document.getElementById("out");
  out.innerHTML = output;
  out.style.color = col;
  scrollToOut = function() {
    out.scrollIntoView(false);
  };
  setTimeout(scrollToOut, 100);
};

blurAll = function() {
  var tmp;
  tmp = document.createElement("input");
  document.body.appendChild(tmp);
  tmp.focus();
  document.body.removeChild(tmp);
};

ref1 = ['pass', 'id', 'sig'];
for (o = 0, len = ref1.length; o < len; o++) {
  id = ref1[o];
  input = document.getElementById(id);
  input.addEventListener('keydown', function(event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      blurAll();
      myFunction();
    }
  });
}

tippy('#base64', {
  content: 'Zero-padding is done in the front. + and / are replaced with ~ and _',
  trigger: 'click',
  delay: 100,
  arrow: true,
  arrowType: 'round',
  size: 'large',
  duration: 500,
  animation: 'scale'
});

(function() {
  var areas, clicked, fn, ref2, u;
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
  for (i = u = 0, ref2 = areas.length; 0 <= ref2 ? u < ref2 : u > ref2; i = 0 <= ref2 ? ++u : --u) {
    fn();
  }
})();

// ---
// generated by coffee-script 1.9.2
