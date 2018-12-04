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


sha = (input) ->
  bigInt(CryptoJS.SHA3(input).toString(), 16).shiftRight(256)

hash = sha
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
  # Curve order
  N: bigInt(1).shiftLeft(252).plus("27742317777372353535851937790883648493")
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

signMessage = (mess, pass) ->
  z = hash(mess)
  d = hash(pass)
  while d.geq(C.N) or d.leq(1) # outrageously unlikely
    pass = pass + "extra"
    d = hash(pass)
  q = elTimes(C.G, d)
  if q[1].lesser(neg(q[1], C.P))
    smallerRootQ = 1
  else
    smallerRootQ = 0
  id = q[0].shiftLeft(1).plus(smallerRootQ)
  phrase = mess + pass
  done = false
  while not done
    phrase = phrase + 'extra'
    k = hash(phrase)
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
  if (id == -1) or (sig == -1)
    return false
  qx = id.shiftRight(1)
  smallerRootQ = id.and(1)
  qy = getY(qx, smallerRootQ)
  if qy == -1
    return false
  q = [qx, qy]
  if not onCurve(q)
    return false
  if not (elTimes(q, C.N) == C.Inf)
    return false
  z = hash(mess)
  r = sig.shiftRight(L)
  s = sig.minus(r.shiftLeft(L))
  verified = false
  if r.greater(0) and r.lesser(C.N) and s.greater(0) and s.lesser(C.N)
    w = s.modInv(C.N)
    u1 = z.times(w).mod(C.N)
    u2 = r.times(w).mod(C.N)
    p = elAdd( elTimes(C.G, u1) , elTimes(q, u2) )
    if p != C.Inf
      x = p[0].mod(C.N)
      if r.eq(x)
        verified = true
  return verified

makeCode = (text) ->
  document.getElementById('qrcode').innerHTML = ''
  if !text
    document.getElementById('idqr').innerHTML = ''
    return
  document.getElementById('idqr').innerHTML = 'ID (QR code):'
  qrcode = new QRCode('qrcode',
    width: 100
    height: 100
    correctLevel: QRCode.CorrectLevel.M)
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
    idString = toBaseKString(id)
    document.getElementById('id').value = idString
    makeCode(idString)
    if mess == ""
      output = "Success! Here's the unique ID corresponding to your Password."
      document.getElementById('sig').value = ""
    else
      output = "Success! Send the message, along with the Signature+ID so \
      they can verify the message is indeed from you."
      document.getElementById('sig').value = toBaseKString(sig)
    col = "green"
  else if id.length > 0 and sig.length > 0
    verified = verifySig(mess, fromBaseKString(id), fromBaseKString(sig))
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
