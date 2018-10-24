base64urlChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_"
charsToBinary = {}
for i in [0...base64urlChars.length]
  st = i.toString(2)
  st = "000000".substr(st.length) + st # 0-pad to get sextets (64 = 2^6)
  charsToBinary[base64urlChars[i]] = st


hash = sha256
L = 256

# Elliptic curve parameters (secp256r1)
C = {
  P: bigInt(
   "FFFFFFFF 00000001 00000000 00000000
    00000000 FFFFFFFF FFFFFFFF FFFFFFFF".replace(/\s+/g, '')
    , 16),
  A: bigInt(
   "FFFFFFFF 00000001 00000000 00000000
    00000000 FFFFFFFF FFFFFFFF FFFFFFFC".replace(/\s+/g, '')
    , 16),
  B: bigInt(
   "5AC635D8 AA3A93E7 B3EBBD55 769886BC 
    651D06B0 CC53B0F6 3BCE3C3E 27D2604B".replace(/\s+/g, '')
    , 16),
  G: [ bigInt(
   "6B17D1F2 E12C4247 F8BCE6E5 63A440F2 
    77037D81 2DEB33A0 F4A13945 D898C296".replace(/\s+/g, ''), 16)
      , bigInt(
   "4FE342E2 FE1A7F9B 8EE7EB4A 7C0F9E16 
    2BCE3357 6B315ECE CBB64068 37BF51F5".replace(/\s+/g, '')
    , 16) ],
  N: bigInt(
   "FFFFFFFF 00000000 FFFFFFFF FFFFFFFF 
    BCE6FAAD A7179E84 F3B9CAC2 FC632551".replace(/\s+/g, '')
    , 16)
  Inf: "O"
}

neg = (a, p) ->
  # returns -a mod p
  if bigInt(a).mod(p).isZero()
    return bigInt.zero
  return bigInt(a).divide(p).plus(1).times(p).minus(a)

onCurve = (p) ->
  # checks if the point `p` is on the curve
  y2 = p[1].modPow(2, C.P)
  test = p[0].modPow(3, C.P)
    .plus(C.A.times(p[0]))
    .plus(C.B).mod(C.P)
  return y2.eq(test)

elAdd = (p1, p2) ->
  # does the elliptical add for `p1` and `p2`
  if p1 == C.Inf
    return p2
  if p2 == C.Inf
    return p1
  p1 = [p1[0].mod(C.P), p1[1].mod(C.P)]
  p2 = [p2[0].mod(C.P), p2[1].mod(C.P)]
  if p1[0].eq(p2[0])
    if p1[1].plus(p2[1]).mod(C.P).isZero()
      return C.Inf
    m = p1[0].modPow(2, C.P).times(3).plus(C.A).times(
      p1[1].times(2).modInv(C.P)
    ).mod(C.P)
  else
    m = (p2[1].plus(neg(p1[1], C.P))).times(
      (p2[0].plus(neg(p1[0], C.P))).modInv(C.P)
    ).mod(C.P)
  xr = m.modPow(2, C.P)
    .plus(neg(p1[0], C.P))
    .plus(neg(p2[0], C.P)).mod(C.P)
  yr = p1[1].plus(m.times(xr.plus(neg(p1[0], C.P))))
  return [xr, neg(yr, C.P)]

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

getRandIntNBits = ->
  n = bigInt(0)
  bytes =  window.crypto.getRandomValues new Uint8Array(N/8)
  for byte in bytes
    n = n.shiftLeft(8).plus(byte)
  return n

base64urlToBin = (base64url) ->
  bin = ''
  for char in base64url
    if not (char in base64urlChars)
      return null
    bin = bin + charsToBinary[char]
  return bin

binToBase64url = (bin) ->
  base64url = ''
  i = bin.length - 6
  while i > 0
    # process in sextets because 64 = 2^6
    base64url = base64urlChars[parseInt(bin[i...i+6], 2)] + base64url
    i -= 6
  base64url = base64urlChars[parseInt(bin[0...i+6], 2)] + base64url
  return base64url

signMessage = (mess, pass) ->
  z = bigInt(hash(mess), 16)
  d = bigInt(hash(pass), 16)
  while d.geq(C.N) or d.leq(1) # outrageously unlikely
    pass = pass + "extra"
    d = bigInt(hash(pass), 16)
  q = elTimes(C.G, d)
  id = q[0].shiftLeft(L).plus(q[1])
  phrase = mess + pass
  done = false
  while not done
    phrase = phrase + 'extra'
    k = bigInt(hash(phrase), 16)
    if k.greater(1) and k.lesser(C.N)
      p = elTimes(C.G, k)
      r = p[0].mod(C.N)
      if r.greater(0)
        s = z.plus(r.times(d))
          .times(k.modInv(C.N))
          .mod(C.N)
        if s.greater(0)
          sig = r.shiftLeft(L).plus(s)
          done = true
  return [id, sig]

verifySig = (mess, id, sig) ->
  if (id == null) or (sig == null)
    return false
  id = bigInt(id, 2)
  temp = id.shiftRight(L)
  q = [temp, id.minus(temp.shiftLeft(L))]
  if not onCurve(q)
    return false
  if not (elTimes(q, C.N) == C.Inf)
    return false
  z = bigInt(hash(mess), 16)
  sig = bigInt(sig, 2)
  r = sig.shiftRight(L)
  s = sig.minus(r.shiftLeft(L))
  verified = false
  if r.greater(0) and r.lesser(C.N) and s.greater(0) and s.lesser(C.N)
    w = s.modInv(C.N)
    u1 = z.times(w).mod(C.N)
    u2 = r.times(w).mod(C.N)
    p = elAdd( elTimes(C.G, u1) , elTimes(q, u2) )
    if p != C.Inf
      if r.eq(p[0])
        verified = true
  return verified

makeCode = (text) ->
  document.getElementById('qrcode').innerHTML = ''
  if !text
    document.getElementById('idqr').innerHTML = ''
    return
  document.getElementById('idqr').innerHTML = 'ID (QR code):'
  qrcode = new QRCode('qrcode',
    width: 180
    height: 180
    correctLevel: QRCode.CorrectLevel.H)
  qrcode.makeCode text
  return

myFunction = ->
  out = document.getElementById("out")
  out.innerHTML = "Working..."
  out.style.color = 'blue'
  out.scrollIntoView(false)
  setTimeout(runVerification, 20)
  return

runVerification = ->
  mess = document.getElementById('mess').value
  id   = document.getElementById('id').value
  sig  = document.getElementById('sig').value
  pass = document.getElementById('pass').value
  makeCode()
  if mess.length == 0
    mess = ""
  if pass.length != 0
    [id, sig] = signMessage(mess, pass)
    idString = binToBase64url(id.toString(2))
    document.getElementById('id').value = idString
    makeCode(idString)
    if mess == ""
      output = "Success! Here's the unique ID corresponding to your Password."
      document.getElementById('sig').value = ""
    else
      output = "Success! Send the message, along with the Signature+ID so \
      they can verify the message is indeed from you."
      document.getElementById('sig').value = binToBase64url(sig.toString(2))
    col = "green"
  else if id.length > 0 and sig.length > 0
    verified = verifySig(mess, base64urlToBin(id), base64urlToBin(sig))
    if verified
      output = "Verification SUCCESS! The signature does indeed match \
      the message from this ID. The other party used the correct password \
      for their ID."
      col = "green"
    else
      output = "Verification FAILED! The signature doesn't match the \
      message from this ID. The other party didn't use the correct password \
      for their ID."
      col = "red"
  else
    output = "Error! Please either enter a Password to get your ID, a \
    Message+Password to generate a Signature, or enter a \
    Message+ID+Signature to verify a Signature."
    col = "orange"
  out = document.getElementById("out")
  out.innerHTML = output
  out.style.color = col
  scrollToOut = ->
    out.scrollIntoView(false)
    return
  setTimeout(scrollToOut, 100)
  return

blurAll = ->
  tmp = document.createElement("input")
  document.body.appendChild(tmp)
  tmp.focus()
  document.body.removeChild(tmp)
  return

# Make enter key work to run things
for id in ['pass', 'id', 'sig']
  input = document.getElementById(id)
  input.addEventListener 'keydown', (event) ->
    if event.keyCode == 13
      event.preventDefault()
      blurAll()
      myFunction()
    return
  
# Tooltip in ending blurb explaining custom base64  
tippy '#base64',
  content: 'Zero-padding is done in the front. + and / are replaced with ~ and _'
  trigger: 'click'
  delay: 100
  arrow: true
  arrowType: 'round'
  size: 'large'
  duration: 500
  animation: 'scale'

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
