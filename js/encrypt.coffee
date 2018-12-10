# Check if ID is already provided, and if so, fill it into the ID section
GET = {}
query = window.location.search.substring(1).split('&')
i = 0
for i in [0...query.length]
  if query[i] == ''
    continue
  param = query[i].split('=')
  GET[decodeURIComponent(param[0])] = decodeURIComponent(param[1] or '')

if "id" of GET
  document.getElementById("id").value = GET["id"]
  out = document.getElementById("out")
  out.innerHTML = "The ID has already been entered through the URL. Just enter a message to encrypt!"
  out.style.color = "green"

# Custom base62 encoding that's only alphanumeric
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
CHARS2IND = {}
for i in [0...CHARS.length]
  CHARS2IND[CHARS[i]] = i
K = CHARS.length

toBaseKString = (n) ->
  st = ""
  qr = n.divmod(K)
  st = CHARS[qr.remainder.value] + st
  while not qr.quotient.isZero()
    qr = qr.quotient.divmod(K)
    st = CHARS[qr.remainder.value] + st
  return st

fromBaseKString = (st) ->
  # returns -1 if erroneous characters are in st
  n = bigInt(0)
  for c in st
    if not (c of CHARS2IND)
      return -1
    n = n.times(K)
    n = n.plus(CHARS2IND[c])
  return n

arrayToBigInt = (arr) ->
  # Because sjcl gives 8 32-bit ints in an array, this convert it to a
  # 256-bit bigInt
  b = ''
  for i in arr
    m = 1
    for _ in [0...32]
      if (i & m) == 0
        b = b + '0'
      else
        b = b + '1'
      m = m << 1
  return bigInt(b, 2)

SALT = "f704a673366fe76fac7a50c55f62453eade6659661e0c58d4ee5726a7cd128fa"

pbkdf2 = (input) ->
  return arrayToBigInt(
    sjcl.misc.pbkdf2(input, SALT, 10000)
  )

sha256 = (input) ->
  return arrayToBigInt(
    sjcl.hash.sha256.hash(input + SALT)
  )

hash = sha256
kdf = pbkdf2
L = 256

neg = (a, p) ->
  # returns -a mod p
  a = bigInt(a)
  if a.mod(p).isZero()
    return bigInt.zero
  return a.divide(p).plus(1).times(p).minus(a)

modsqrt = (n, p) ->
  # Computes an x such that x^2 = n mod p. Uses Tonelli-Shanks algorithm.
  # If there is no such x, returns -1. If p is not prime, returns -1.
  n = bigInt(n)
  p = bigInt(p)
  if not p.isPrime()
    return -1
  if n.isZero()
    return bigInt(0)
  if not n.modPow(p.minus(1).divide(2), p).eq(1)
    return -1 # n is not a square mod p
  if p.mod(4).eq(3) # Easy case
    return n.modPow(p.plus(1).divide(4), p)
  s = bigInt(0)
  q = p.minus(1)
  while q.isEven()
    s = s.plus(1)
    q = q.shiftRight(1)
  z = bigInt(Math.floor(p*Math.random())) # random z
  while z.isZero() or z.modPow(p.minus(1).divide(2), p).eq(1)
    z = bigInt(Math.floor(p*Math.random()))
  m = s
  c = z.modPow(q, p)
  t = n.modPow(q, p)
  r = n.modPow(q.plus(1).divide(2), p)
  while true
    if t.eq(0)
      return bigInt(0)
    if t.eq(1)
      return r
    i = bigInt(0)
    temp = t
    while not temp.eq(1)
      temp = temp.modPow(2, p)
      i = i.plus(1)
    b = c.modPow(bigInt(1).shiftLeft(m.minus(i).minus(1).value), p)
    m = i
    c = b.modPow(2, p)
    t = t.times(c).mod(p)
    r = r.times(b).mod(p)


# Elliptic curve parameters (curve25519)
C = {
  # B y^2 = x^3 + A x^2 + x mod P
  P: bigInt(1).shiftLeft(255).minus(19), #2^255 - 19
  A: bigInt(486662),
  B: bigInt(1),
  # base or generator point
  G: [ bigInt(9)
      , bigInt("14781619447589544791020593568409986887264606134616475288964881837755586237401", 10) ],
  Inf: "O"
}

getY = (x, smallerRootQ) ->
  # returns the y coordinate corresponding to the x coordinate. If
  # smallerRootQ is 1, then returns the smaller square root, else returns
  # the larger one.
  smallerRootQ = bigInt(smallerRootQ)
  y2 = x.modPow(3, C.P)
    .plus(C.A.times(x.modPow(2, C.P)))
    .plus(x).mod(C.P)
  y1 = modsqrt(y2, C.P)
  if y1 == -1 # Some error occurred
    return -1
  y2 = neg(y1, C.P)
  if y2.lesser(y1)
    [y2, y1] = [y1, y2] # swap
  if smallerRootQ.value == 1
    return y1
  return y2

onCurve = (p) ->
  # checks if the point `p` is on the curve
  lhs = C.B.times(p[1].modPow(2, C.P)).mod(C.P)
  rhs = p[0].modPow(3, C.P)
    .plus(C.A.times(p[0].modPow(2, C.P)))
    .plus(p[0]).mod(C.P)
  return lhs.eq(rhs)

elAdd = (p1, p2) ->
  # does the elliptical add for `p1` and `p2`
  if p1 == C.Inf
    return p2
  if p2 == C.Inf
    return p1
  if not (onCurve(p1) and onCurve(p2))
    return -1
  p1 = [p1[0].mod(C.P), p1[1].mod(C.P)]
  p2 = [p2[0].mod(C.P), p2[1].mod(C.P)]
  if p1[0].eq(p2[0])
    if p1[1].plus(p2[1]).mod(C.P).isZero()
      return C.Inf
    x = p1[0].modPow(2, C.P).plus(neg(1, C.P)).modPow(2, C.P)
      .times(p1[1].modPow(2, C.P).times(4).times(C.B).modInv(C.P)).mod(C.P)
    temp = p1[0].modPow(2, C.P).times(3)
      .plus(C.A.times(2).times(p1[0]))
      .plus(1).mod(C.P)
      .times(C.B.times(p1[1]).times(2).modInv(C.P)).mod(C.P)
    y = p1[0].times(3).plus(C.A).times(temp)
      .plus(neg(C.B.times(temp.modPow(3, C.P)), C.P))
      .plus(neg(p1[1], C.P))
  else
    x = C.B.times(
      p2[0].times(p1[1]).plus(neg(p1[0].times(p2[1]), C.P))
        .modPow(2, C.P)
    ).times(
      p1[0].times(p2[0]).times(p2[0].plus(neg(p1[0], C.P)).modPow(2, C.P)).modInv(C.P)
    ).mod(C.P)
    y = p1[0].times(2).plus(p2[0]).plus(C.A).times(p2[1].plus(neg(p1[1], C.P)))
        .times(p2[0].plus(neg(p1[0], C.P)).modInv(C.P)).mod(C.P)
        .plus(
          neg(
            C.B.times(p2[1].plus(neg(p1[1], C.P)).modPow(3, C.P))
              .times(p2[0].plus(neg(p1[0], C.P)).modPow(3, C.P).modInv(C.P))
              , C.P)
        ).plus(neg(p1[1], C.P)).mod(C.P)
  return [x, y]

elTimes = (p, n) ->
  # does the elliptical multiplication of point `p` by `n`
  n = bigInt(n)
  res = C.Inf
  dub = p
  while not n.isZero()
    if n.and(1).eq(1)
      res = elAdd(res, dub)
    dub = elAdd(dub, dub)
    n = n.shiftRight(1)
  return res

getRandBytes = (k)->
  n = bigInt(0)
  bytes =  window.crypto.getRandomValues new Uint8Array(k)
  for byte in bytes
    n = n.shiftLeft(8).plus(byte)
  return n

base64ToHex = (base64) ->
  raw = atob(base64)
  HEX = ''
  for i in [0...raw.length]
    _hex = raw.charCodeAt(i).toString(16)
    HEX += if _hex.length == 2 then _hex else '0' + _hex
  return HEX.toUpperCase()

hexToBase64 = (hexstring) ->
  btoa hexstring.match(/\w{2}/g).map((a) ->
    String.fromCharCode parseInt(a, 16)
  ).join('')

aes_enc = (pass, data) ->
  encoded = sjcl.encrypt(pass, data, {mode:'gcm'})
  eval('e = ' + encoded)
  ct = bigInt(base64ToHex(e.ct), 16)     # variable length
  iv = bigInt(base64ToHex(e.iv), 16)     # 128-bit
  slt = bigInt(base64ToHex(e.salt), 16) # 64-bit
  x = ct.shiftLeft(128).plus(iv).shiftLeft(64).plus(slt)
  return x

aes_dec = (pass, x) ->
  o = bigInt(1)
  slt = hexToBase64(x.mod(o.shiftLeft(64)).toString(16))
  iv = hexToBase64(x.shiftRight(64).mod(o.shiftLeft(128)).toString(16))
  ct = hexToBase64(x.shiftRight(64+128).toString(16))
  encoded = "{\"iv\":\"" + iv + "\",\"v\":1,\"iter\":10000,\"ks\":128,\"ts\":64,\"mode\":\"gcm\",\"adata\":\"\",\"cipher\":\"aes\",\"salt\":\"" + slt + "\",\"ct\":\"" + ct + "\"}"
  try
    data = sjcl.decrypt(pass, encoded)
  catch err
    data = -1
  return data

getID = (pass) ->
  a = kdf(pass)
  while a.geq(C.P) or a.leq(1) # outrageously unlikely
    pass = pass + "extra"
    a = kdf(pass)
  key = elTimes(C.G, a)
  if key[1].lesser(neg(key[1], C.P))
    smallerRootQ = 1
  else
    smallerRootQ = 0
  id = key[0].shiftLeft(1).plus(smallerRootQ)
  return id

encrypt = (mess, id) ->
  smallerRootQ = id.and(1)
  keyx = id.shiftRight(1)
  keyy = getY(keyx, smallerRootQ)
  if keyy == -1
    return -1
  key = [keyx, keyy]
  if not onCurve(key)
    return -1
  r = getRandBytes(L/8)
  b = hash(mess + r.toString(2)) # Add random bits to obfuscate
  while b.geq(C.P) or b.leq(1) # outrageously unlikely
    r = getRandBytes(L/8)
    b = hash(mess + r.toString(2))
  B = elTimes(C.G, b)
  if B[1].lesser(neg(B[1], C.P))
    smallerRootQ = 1
  else
    smallerRootQ = 0
  id = B[0].shiftLeft(1).plus(smallerRootQ)
  sharedKey = elTimes(key, b)
  sharedKey = sharedKey[0].shiftLeft(L).plus(sharedKey[1])
  pass = toBaseKString(sharedKey)
  e = aes_enc(pass, mess)
  encrypted = e.shiftLeft(L+1).plus(id)
  return encrypted

decrypt = (pass, encrypted) ->
  a = kdf(pass)
  while a.geq(C.P) or a.leq(1) # outrageously unlikely
    pass = pass + "extra"
    a = kdf(pass)
  o = bigInt(1)
  id = encrypted.mod(o.shiftLeft(L+1))
  e = encrypted.shiftRight(L+1)
  smallerRootQ = id.and(1)
  Bx = id.shiftRight(1)
  By = getY(Bx, smallerRootQ)
  if By == -1
    return -1
  B = [Bx, By]
  if not onCurve(B)
    return -1
  sharedKey = elTimes(B, a)
  sharedKey = sharedKey[0].shiftLeft(L).plus(sharedKey[1])
  pass = toBaseKString(sharedKey)
  mess = aes_dec(pass, e)
  return mess

makeCode = (text) ->
  # If provided text, makes the QR code for the text. Else, destroys the
  # previous QR code.
  document.getElementById('qrcode').innerHTML = ''
  if !text
    document.getElementById('idqr').innerHTML = ''
    return
  document.getElementById('idqr').innerHTML = 'ID (QR code):'
  qrcode = new QRCode('qrcode',
    width: 128
    height: 128
    correctLevel: QRCode.CorrectLevel.M)
  qrcode.makeCode text
  return

if not ("id" of GET)
  # Generate 128-bit password by default
  document.getElementById("pass").value = toBaseKString(getRandBytes(16))

myFunction = ->
  out = document.getElementById("out")
  out.innerHTML = "Working..."
  out.style.color = 'blue'
  out.scrollIntoView(false)
  setTimeout(runEncryption, 40)
  return

runEncryption = ->
  mess = document.getElementById('mess').value
  id   = document.getElementById('id').value
  enc  = document.getElementById('enc').value
  pass = document.getElementById('pass').value
  makeCode()
  if pass.length != 0
    document.getElementById('mess').value = ""
    if enc.length == 0
      id = getID(pass)
      idString = toBaseKString(id)
      document.getElementById('id').value = idString
      output = "Success! Here's your ID! Send it to anyone so they can encrypt messages that only you can decrypt. Or send them <a href='https://www.chausies.xyz/encrypt?id=" + idString + "' target='_blank'>this url</a>."
      col = "green"
      makeCode('https://www.chausies.xyz/encrypt?id=' + idString)
    else
      encrypted = fromBaseKString(enc)
      if encrypted == -1 # bad characters provided in the base-K string
        mess = ""
      else
        mess = decrypt(pass, encrypted)
      if mess == -1
        output = "Error! The Password doesn't match the Encrypted Message."
        col = "red"
      else
        document.getElementById('mess').value = mess
        output = "Success! The Encrypted Message has been decrypted!"
        col = "green"
  else
    if id.length == 0
      if mess.length == 0
        output = "Error! Nothing entered. Please either enter a Password to get your ID, an ID+Message to get an Encrypted Message, or an Encrypted Message+Password to get the original Message."
      else
        output = "Error! Please enter the ID of the person for whom the Message is being encryted."
      col = "red"
    else
      if mess.length == 0
        output = "Error! Please enter a Message to encrypt"
        col = "red"
      else
        id = fromBaseKString(id)
        if id != -1 # Bad base K String provided
          encrypted = encrypt(mess, id)
        if (id == -1) or (encrypted == -1)
          output = "Error! ID was probably invalid"
          col = "red"
        else
          eString = toBaseKString(encrypted)
          document.getElementById('enc').value = eString
          output = "Success! Send over the Encrypted Message to the other party."
          col = "green"
  out = document.getElementById("out")
  out.innerHTML = output
  out.style.color = col
  scrollToOut = ->
    out.scrollIntoView(false)
    return
  setTimeout(scrollToOut, 200)
  return

blurAll = ->
  tmp = document.createElement("input")
  document.body.appendChild(tmp)
  tmp.focus()
  document.body.removeChild(tmp)
  return

# Make enter key work to run things
for id in ['pass', 'id', 'enc']
  input = document.getElementById(id)
  input.addEventListener 'keydown', (event) ->
    if event.keyCode == 13
      event.preventDefault()
      blurAll()
      myFunction()
    return
  
# Highlight ID/Signature on first click (for ease of copying/deleting)
do ->
  areas = document.querySelectorAll('.highlight')
  clicked = Array(areas.length).fill(false)
  for i in [0...areas.length]
    do ->
      j = i
      area = areas[j]
      area.addEventListener 'click', ->
        if !clicked[j]
          area.select()
          clicked[j] = true
        return
      area.addEventListener 'blur', ->
        clicked[j] = false
        return
  return
