use rand8::{Rng, seq::index};
use std::iter::FromIterator;
use bls12_381::{G1Affine, G1Projective, Scalar, G2Affine, G2Projective, pairing};
use std::{convert::TryInto, vec};
use group::Curve;
use sha256::digest;
use hex::FromHex;
use aes_gcm_siv::{Aes256GcmSiv, KeyInit, aead::{Aead, generic_array::GenericArray}};

fn main() {
    let (sks, pks) = batch_get_keypairs(4);
    println!("sks: {:?}", sks);
    let exported_pks: Vec<String> = pks.clone().into_iter().map(|pk| export_pk(&pk)).collect();
    println!("pks: {:?}", exported_pks);
    let imported_pks: Vec<G1Projective> = exported_pks.clone().into_iter().map(|pk| import_pk(&pk)).collect();
    println!("Import export test: {:?}", pks==imported_pks);

    let r = gen_r();
    // println!("r: {:?}", r);

    let t: u64 = 3;
    
    let (k, mut alphas_rest) = get_k_and_alphas(&r, &vec![1,2,3,4], &pks, t);
    println!("k: {:?}", k);
    println!("alphas: {:?}", alphas_rest);
    let mut alphas: Vec<Scalar> = vec![Scalar::zero(); t as usize];
    alphas.append(&mut alphas_rest);

    // Test recover k
    let shares124 = client_get_shares(&r, &vec![pks[0],pks[1],pks[3]]);
    let alphas124 = vec![alphas[0], alphas[1], alphas[3]];
    let k1 = recover_k(&vec![1,2,4], &shares124, &alphas124);
    if k1 != k {
        println!("Test 124 failed.");
    }
    else {
        println!("Test 124 passed.");
    }

    let shares134 = client_get_shares(&r, &vec![pks[0],pks[2],pks[3]]);
    let alphas134 = vec![alphas[0], alphas[2], alphas[3]];
    let k2 = recover_k(&vec![1,3,4], &shares134, &alphas134);
    if k2 != k {
        println!("Test 134 failed.");
    }
    else {
        println!("Test 134 passed.");
    }

    let msg = b"this is a sample transaction";
    let nonce = b"112342345223";
    let key: [u8; 32]= k.to_bytes();
    let ciphertext = encrypt(msg, &key, nonce);
    let plaintext: [u8; 28] = decrypt(&ciphertext, &key, nonce)[0..28].try_into().unwrap();
    println!("Encryption correctness: {:?}", *msg==plaintext);
    println!("Verification correctness: {:?}", verify_share(&node_get_share(&sks[0], &get_g1r(&r)), &pks[0], &get_g2r(&r)));
}

fn import_pk(pk: &str) -> G1Projective{
    let bytes = hex::decode(pk).unwrap();
    let array = bytes[..48].try_into().map_err(|_| base64::DecodeError::InvalidLength).unwrap();
    let pk_affine = G1Affine::from_compressed(&array).unwrap();
    return G1Projective::from(pk_affine);
}

fn export_pk(pk: &G1Projective) -> String{
    let pk_affine = G1Affine::from(pk);
    let array = G1Affine::to_compressed(&pk_affine);
    return hex::encode(array);
}

fn batch_get_keypairs(number: u8) -> (Vec<Scalar>, Vec<G1Projective>){
    let mut sks = vec![];
    let mut pks = vec![];
    for _ in 0..number{
        let (sk, pk) = gen_keypair();
        sks.push(sk);
        pks.push(pk);
    }
    return (sks, pks);
}

pub fn gen_r() -> Scalar{
    let rand = rand8::thread_rng().gen::<[u8; 32]>();
    let le_bytes = bytes_to_le(&rand);
    // little endian bytes required
    let r = Scalar::from_bytes(&le_bytes).unwrap_or(Scalar::zero());
    return r;
}

pub fn get_g1r(r: &Scalar) -> G1Projective{
    return r*G1Projective::generator();
}

pub fn get_g2r(r: &Scalar) -> G2Projective{
    return r*G2Projective::generator();
}

fn bytes_to_le(bytes: &[u8; 32]) -> [u8; 32]{
    let mut le_bytes = [0u8; 32];
    for i in 0..bytes.len()-4{
        if i % 4 == 0{
            le_bytes[i] = bytes[i+3];
        }
        else if i % 4 == 1{
            le_bytes[i] = bytes[i+1];
        }
        else if i % 4 == 2{
            le_bytes[i] = bytes[i-1];
        }
        else if i % 4 == 3{
            le_bytes[i] = bytes[i-3];
        }
    }
    return le_bytes;
}

pub fn client_get_shares(r: &Scalar, pks: &Vec<G1Projective>) -> Vec<Scalar>{
    let shares = pks.into_iter().map(|pk| point_to_scalar(&(pk*r))).collect();
    return shares;
}

pub fn node_get_share(sk: &Scalar, g1r: &G1Projective) -> G1Projective{
    sk*g1r
}

pub fn get_k_and_alphas(r: &Scalar, indexes: &Vec<u64>, pks: &Vec<G1Projective>, t: u64) -> (Scalar, Vec<Scalar>){
    let shares = client_get_shares(r, pks);
    let first_t_indexes = indexes[0..t as usize].to_vec();
    let basis = lagrange_basis(&first_t_indexes, Scalar::zero());
    let k = lagrange_interpolate(&basis, &shares);

    let mut alphas: Vec<Scalar> = vec![];
    let rest_indexes = indexes[t as usize..indexes.len()].to_vec();
    
    let mut counter = t;
    for i in rest_indexes{
        let i_basis = lagrange_basis(&first_t_indexes, Scalar::from(i));
        let p = lagrange_interpolate(&i_basis, &shares).to_bytes();
        let alpha_bytes: Vec<u8> = p.iter().zip(shares[counter as usize].clone().to_bytes().iter()).map(|(&x1, &x2)| x1 ^ x2).collect();
        let alpha = Scalar::from_bytes(&alpha_bytes[..32].try_into().unwrap()).unwrap();
        alphas.push(alpha);
        counter += 1;
    }
    return (k, alphas);
}

fn lagrange_basis(indexes: &Vec<u64>, x: Scalar) -> Vec<Scalar>{
    let mut basis = Vec::new();
    for i in indexes.into_iter(){
        let mut numerator = Scalar::from(1);
        let mut denominator = Scalar::from(1);
        for j in indexes.into_iter(){
            if i != j{
                numerator = numerator * (x.clone() - Scalar::from(*j));
	            denominator = denominator * (Scalar::from(*i) - Scalar::from(*j));
            }
        }
        let result = numerator*(denominator.invert().unwrap());
        basis.push(result);
    }
    return basis;
}

fn lagrange_interpolate(basis: &Vec<Scalar>, terms: &Vec<Scalar>) -> Scalar{
    let mut result = terms[0].clone()*basis[0].clone();
    for i in 1..basis.len(){
        result = result + terms[i].clone()*basis[i].clone();
    }
    return result;
}

pub fn gen_keypair() -> (Scalar, G1Projective){
    let sk = gen_r();
    let pk = G1Affine::generator()*sk;
    return (sk, pk);
}

pub fn recover_k(indexes: &Vec<u64>, shares: &Vec<Scalar>, alphas: &Vec<Scalar>) -> Scalar{
    let basis = lagrange_basis(indexes, Scalar::zero());
    let mut terms: Vec<Scalar> = vec![];
    for i in 0..shares.len(){
        let p: Vec<u8> =  alphas[i].clone().to_bytes().iter().zip(shares[i].clone().to_bytes().iter()).map(|(&x1, &x2)| x1 ^ x2).collect();
        terms.push(Scalar::from_bytes(&p[..32].try_into().unwrap()).unwrap());
    }
    let k = lagrange_interpolate(&basis, &terms);
    return k;
}

fn point_to_scalar(point: &G1Projective) -> Scalar{
    let p_bytes = &point.to_affine().to_compressed();
    let p_digest = digest(p_bytes);
    let p_digest_bytes = <[u8; 32]>::from_hex(p_digest).expect("Decoding failed");
    let p_scalar = Scalar::from_bytes(&bytes_to_le(&p_digest_bytes)).unwrap();
    return p_scalar;
}

pub fn encrypt(msg: &[u8], key: &[u8; 32], nonce: &[u8; 12]) -> Vec<u8>{
    let cipher = Aes256GcmSiv::new(&GenericArray::from_slice(key));
    let nonce = GenericArray::from_slice(nonce);
    let ciphertext = cipher.encrypt(nonce, msg).unwrap();
    return ciphertext;
}

pub fn decrypt(msg: &[u8], key: &[u8; 32], nonce: &[u8; 12]) -> Vec<u8>{
    let cipher = Aes256GcmSiv::new(&GenericArray::from_slice(key));
    let nonce = GenericArray::from_slice(nonce);
    let plaintext = cipher.decrypt(nonce, msg).unwrap();
    return plaintext;
}

pub fn verify_share(share_point: &G1Projective, pk: &G1Projective, g2r: &G2Projective) -> bool{
    let share_affine = G1Affine::from(share_point);
    let pk_affine = G1Affine::from(pk);
    let g2r_affine = G2Affine::from(g2r);
    return pairing(&share_affine, &G2Affine::generator()) == pairing(&pk_affine, &g2r_affine);
}

fn share_point_to_secret_share(share_point: &G1Projective, alpha: &Scalar) -> Scalar{
    return alpha + point_to_scalar(share_point);
}