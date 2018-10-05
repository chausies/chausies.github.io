var L, N, base64ToHex, blurAll, g, getRandIntNBits, hexToBase64, id, input, j, len, makeCode, myFunction, p, q, ref, signMessage, verifySig;

N = 256;

L = 3072;

q = bigInt("49033245831086025454248374804313550553890476843957890600488261886959243458577");

p = bigInt("1959594137336272079900295230453245230232283138127696153658202902948229752004244921442047844636785036005010768857345906862213545610698056468291443530544652617138971818247496754436444432216110151705642414039689451881699712467175999435306350274792539382973437402400695463411949654639768727536719625723161945068103294061530322573714821021804938183897023191772676505064921119304536453461109499449391925673827865235939224457837031681778359095714607269291571835800126619946098391763668941090158691540911011595705968610440958742069714835690036601632748056285082956092470267193211142954828689196965324708483033700674554749014546589645227093855318162430637658106618782395912187022895651324254571622863375452295307070076028880744889966612244847778762339190021445171790417439325557157981841089305267299764941504636387469977687465858479715402322538708314995237534877498553843234644629587594098254519918894765294860700515304583554234869667");

g = bigInt("1808978895139253291177604369079932052066134166721345153794075622029518665386563996205328937918210230542097401932921022862848530434415556273819709447374554647913381010895013237008734425065956455445156180453994714737279595156717931860425117350741663664350267313127049623997517241945129206195271017471514332959174909981906073571177218527209160776531534688264636561880208353239778596147942855320577213988275525316476460328605863082737419756304037603085043514087590383589103128152735289910584622911150453482649604508516918006756782126018592034681269851361449700639859514602488451449854827124264805903465814764997123513891324185537282768147198485965971512959876668076650580440225244089311685177043096725019797507128259428618797013598025156447787896675971935758697321276982909954217432106711597060924861723215592970692094604335597904170328520658729633240180370391695859886228990113737418763820851671056483908727767604178598696985554");

getRandIntNBits = function() {
  var byte, bytes, j, len, n;
  n = bigInt(0);
  bytes = window.crypto.getRandomValues(new Uint8Array(N / 8));
  for (j = 0, len = bytes.length; j < len; j++) {
    byte = bytes[j];
    n = n.shiftLeft(8).plus(byte);
  }
  return n;
};

hexToBase64 = function(hexstring) {
  return btoa(hexstring.match(/\w{2}/g).map(function(a) {
    return String.fromCharCode(parseInt(a, 16));
  }).join(''));
};

base64ToHex = function(base64) {
  var Hex, _hex, i, raw;
  raw = atob(base64);
  Hex = '';
  i = 0;
  while (i < raw.length) {
    _hex = raw.charCodeAt(i).toString(16);
    Hex += _hex.length === 2 ? _hex : '0' + _hex;
    i++;
  }
  return Hex.toUpperCase();
};

signMessage = function(mess, pass) {
  var done, h, k, r, s, sig, x, y;
  x = bigInt(sha256(pass), 16);
  y = g.modPow(x, p);
  h = bigInt(sha256(mess), 16);
  done = false;
  while (!done) {
    k = getRandIntNBits();
    if (k.greater(0)) {
      r = g.modPow(k, p).mod(q);
      if (r.greater(0)) {
        s = k.modInv(q).times(h.plus(x.times(r))).mod(q);
        if (s.greater(0)) {
          sig = r.shiftLeft(N).plus(s);
          done = true;
        }
      }
    }
  }
  return [y, sig];
};

verifySig = function(mess, id, sig) {
  var h, r, s, u1, u2, v, verified, w, y;
  h = bigInt(sha256(mess), 16);
  y = bigInt(id, 16);
  sig = bigInt(sig, 16);
  r = sig.shiftRight(N);
  s = sig.minus(r.shiftLeft(N));
  verified = false;
  if (r.greater(0) && r.lesser(q) && s.greater(0) && s.lesser(q)) {
    w = s.modInv(q);
    u1 = h.times(w).mod(q);
    u2 = r.times(w).mod(q);
    v = g.modPow(u1, p).times(y.modPow(u2, p)).mod(p).mod(q);
    verified = v.eq(r);
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
    width: 240,
    height: 240,
    correctLevel: QRCode.CorrectLevel.H
  });
  qrcode.makeCode(text);
};

myFunction = function() {
  var col, id, idString, mess, out, output, pass, ref, sig, verified;
  mess = document.getElementById('mess').value;
  id = document.getElementById('id').value;
  sig = document.getElementById('sig').value;
  pass = document.getElementById('pass').value;
  makeCode();
  if (mess.length === 0) {
    mess = "";
  }
  if (pass.length !== 0) {
    ref = signMessage(mess, pass), id = ref[0], sig = ref[1];
    idString = hexToBase64(id.toString(16));
    document.getElementById('id').value = idString;
    makeCode(idString);
    if (mess === "") {
      output = "Success! Here's the unique ID corresponding to your Password.";
      document.getElementById('sig').value = "";
    } else {
      output = "Success! Send the message, along with the Signature+ID so they can verify the message is indeed from you.";
      document.getElementById('sig').value = hexToBase64(sig.toString(16));
    }
    col = "green";
  } else if (id.length > 0 && sig.length > 0) {
    verified = verifySig(mess, base64ToHex(id), base64ToHex(sig));
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
};

blurAll = function() {
  var tmp;
  tmp = document.createElement("input");
  document.body.appendChild(tmp);
  tmp.focus();
  document.body.removeChild(tmp);
};

ref = ['pass', 'id', 'sig'];
for (j = 0, len = ref.length; j < len; j++) {
  id = ref[j];
  input = document.getElementById(id);
  input.addEventListener('keydown', function(event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      blurAll();
      myFunction();
    }
  });
}

// ---
// generated by coffee-script 1.9.2
