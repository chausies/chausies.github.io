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

base64urlChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_"
charsToBinary = {}
for i in [0...base64urlChars.length]
  st = i.toString(2)
  st = "000000".substr(st.length) + st # 0-pad to get sextets (64 = 2^6)
  charsToBinary[base64urlChars[i]] = st


sha256 = (input) ->
  bigInt(CryptoJS.SHA3(input).toString(), 16).shiftRight(256)

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

getRandIntLBits = ->
  n = bigInt(0)
  bytes =  window.crypto.getRandomValues new Uint8Array(L/8)
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
  return bigInt(
    base64ToHex(
      CryptoJS.AES.encrypt(data, pass).toString()
    )
    , 16)

aes_dec = (pass, x) ->
  return CryptoJS.AES.decrypt(
    hexToBase64(x.toString(16))
    , pass).toString(CryptoJS.enc.Utf8)

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

getKey = (pass) ->
  a = hash(pass)
  while a.geq(C.N) or a.leq(1) # outrageously unlikely
    pass = pass + "extra"
    a = hash(pass)
  key = elTimes(C.G, a)
  return key

encrypt = (mess, id) ->
  o = bigInt(1)
  key = [id.shiftRight(L), id.mod(o.shiftLeft(L))]
  r = getRandIntLBits()
  b = hash(mess + r.toString(2)) # Add random bits to obfuscate
  while b.geq(C.N) or b.leq(1) # outrageously unlikely
    r = getRandIntLBits()
    b = hash(mess + r.toString(2))
  B = elTimes(C.G, b)
  id = B[0].shiftLeft(L).plus(B[1])
  sharedKey = elTimes(key, b)
  sharedKey = sharedKey[0].shiftLeft(L).plus(sharedKey[1])
  pass = binToBase64url(sharedKey.toString(2))
  e = aes_enc(pass, mess)
  encrypted = e.shiftLeft(2*L).plus(id)
  return encrypted

decrypt = (pass, encrypted) ->
  a = hash(pass)
  while a.geq(C.N) or a.leq(1) # outrageously unlikely
    pass = pass + "extra"
    a = hash(pass)
  o = bigInt(1)
  id = encrypted.mod(o.shiftLeft(2*L))
  e = encrypted.shiftRight(2*L)
  B = [id.shiftRight(L), id.mod(o.shiftLeft(L))]
  sharedKey = elTimes(B, a)
  sharedKey = sharedKey[0].shiftLeft(L).plus(sharedKey[1])
  pass = binToBase64url(sharedKey.toString(2))
  mess = aes_dec(pass, e)
  return mess

makeCode = (text) ->
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

myFunction = ->
  out = document.getElementById("out")
  out.innerHTML = "Working..."
  out.style.color = 'blue'
  out.scrollIntoView(false)
  setTimeout(runVerification, 40)
  return

runVerification = ->
  mess = document.getElementById('mess').value
  id   = document.getElementById('id').value
  enc  = document.getElementById('enc').value
  pass = document.getElementById('pass').value
  makeCode()
  if pass.length != 0
    document.getElementById('mess').value = ""
    if enc.length == 0
      idp = getKey(pass)
      id = idp[0].shiftLeft(L).plus(idp[1])
      idString = binToBase64url(id.toString(2))
      document.getElementById('id').value = idString
      output = "Success! Here's your ID! Send it to anyone so they can encrypt messages that only you can decrypt. Or send them <a href='https://www.chausies.xyz/encrypt?id=" + idString + "'>this url</a>."
      col = "green"
      makeCode('https://www.chausies.xyz/encrypt?id=' + idString)
    else
      encrypted = bigInt(base64urlToBin(enc), 2)
      mess = decrypt(pass, encrypted)
      if mess.length == 0
        output = "Error! The Password likely doesn't match the Encrypted Message."
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
        id = bigInt(base64urlToBin(id), 2)
        encrypted = encrypt(mess, id)
        eString = binToBase64url(encrypted.toString(2))
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
