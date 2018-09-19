N = 256
L = 3072
q = bigInt("4903324583108602545424837480431355055389047684395789060048826188695924\
3458577")
p = bigInt("1959594137336272079900295230453245230232283138127696153658202902948229\
7520042449214420478446367850360050107688573459068622135456106980564682\
9144353054465261713897181824749675443644443221611015170564241403968945\
1881699712467175999435306350274792539382973437402400695463411949654639\
7687275367196257231619450681032940615303225737148210218049381838970231\
9177267650506492111930453645346110949944939192567382786523593922445783\
7031681778359095714607269291571835800126619946098391763668941090158691\
5409110115957059686104409587420697148356900366016327480562850829560924\
7026719321114295482868919696532470848303370067455474901454658964522709\
3855318162430637658106618782395912187022895651324254571622863375452295\
3070700760288807448899666122448477787623391900214451717904174393255571\
5798184108930526729976494150463638746997768746585847971540232253870831\
4995237534877498553843234644629587594098254519918894765294860700515304\
583554234869667")
g = bigInt("1808978895139253291177604369079932052066134166721345153794075622029518\
6653865639962053289379182102305420974019329210228628485304344155562738\
1970944737455464791338101089501323700873442506595645544515618045399471\
4737279595156717931860425117350741663664350267313127049623997517241945\
1292061952710174715143329591749099819060735711772185272091607765315346\
8826463656188020835323977859614794285532057721398827552531647646032860\
5863082737419756304037603085043514087590383589103128152735289910584622\
9111504534826496045085169180067567821260185920346812698513614497006398\
5951460248845144985482712426480590346581476499712351389132418553728276\
8147198485965971512959876668076650580440225244089311685177043096725019\
7975071282594286187970135980251564477878966759719357586973212769829099\
5421743210671159706092486172321559297069209460433559790417032852065872\
9633240180370391695859886228990113737418763820851671056483908727767604\
178598696985554")

getRandIntNBits = ->
  n = bigInt(0)
  bytes =  window.crypto.getRandomValues new Uint8Array(N/8)
  for byte in bytes
    n = n.shiftLeft(8).plus(byte)
  return n

hexToBase64 = (hexstring) ->
  return btoa hexstring.match(/\w{2}/g).map((a) ->
    return String.fromCharCode parseInt(a, 16)
  ).join('')
 
base64ToHex = (base64) ->
  raw = atob(base64)
  Hex = ''
  i = 0
  while i < raw.length
    _hex = raw.charCodeAt(i).toString(16)
    Hex += if _hex.length == 2 then _hex else '0' + _hex
    i++
  return Hex.toUpperCase()

signMessage = (mess, pass) ->
  x = bigInt(sha256(pass), 16)
  y = g.modPow(x,p)
  h = bigInt(sha256(mess), 16)
  done = false
  while not done
    k = getRandIntNBits()
    if k.greater(0)
      r = g.modPow(k, p).mod(q)
      if r.greater(0)
        s = k.modInv(q).times(h.plus(x.times(r))).mod(q)
        if s.greater(0)
          sig = r.shiftLeft(N).plus(s)
          done = true
  return [y, sig]

verifySig = (mess, id, sig) ->
  h = bigInt(sha256(mess), 16)
  y = bigInt(id, 16)
  sig = bigInt(sig, 16)
  r = sig.shiftRight(N)
  s = sig.minus(r.shiftLeft(N))
  verified = false
  if r.greater(0) and r.lesser(q) and s.greater(0) and s.lesser(q)
    w = s.modInv(q)
    u1 = h.times(w).mod(q)
    u2 = r.times(w).mod(q)
    v = g.modPow(u1, p).times(y.modPow(u2, p)).mod(p).mod(q)
    verified = v.eq(r)
  return verified

myFunction = ->
  mess = document.getElementById('mess').value
  id   = document.getElementById('id').value
  sig  = document.getElementById('sig').value
  pass = document.getElementById('pass').value
  if mess.length == 0
    mess = ""
  if pass.length != 0
    [id, sig] = signMessage(mess, pass)
    document.getElementById('id').value = hexToBase64(id.toString(16))
    if mess == ""
      output = "Success! Here's the unique ID corresponding to your Password."
      document.getElementById('sig').value = ""
    else
      output = "Success! Send the message, along with the Signature+ID so \
      they can verify the message is indeed from you."
      document.getElementById('sig').value = hexToBase64(sig.toString(16))
    col = "green"
  else if id.length > 0 and sig.length > 0
    verified = verifySig(mess, base64ToHex(id), base64ToHex(sig))
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
  return
