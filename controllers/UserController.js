import User from "../models/User.js";
import bcrypt from 'bcrypt';
import {validationResult} from "express-validator";

import User from '../models/User.js';
import {
    AccountId,
    PrivateKey,
    Client,
    AccountBalanceQuery,
    AccountInfoQuery,
    TransferTransaction,
  } from "@hashgraph/sdk";
  import dotenv from 'dotenv';
  dotenv.config();
  import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
  const accountIdString = process.env.ACCOUNT_ID;
const privateKeyString = process.env.ACCOUNT_PRIVATE_KEY;
const tokenId = process.env.TOKEN_ID
if (accountIdString === undefined || privateKeyString === undefined) { throw new Error('account id and private key in env file are empty') }

const operatorAccountId = AccountId.fromString(accountIdString);
const operatorPrivateKey = PrivateKey.fromString(privateKeyString);

const client = Client.forTestnet().setOperator(operatorAccountId, operatorPrivateKey);
export async function signin(req, res) {
  const { identifier, password } = req.body;

  try {
    console.log('Identifier:', identifier);
    console.log('password:', password);

    // Determine if the identifier is an email or a username
    let user = await User.findOne({
      $or: [
        { "Email": identifier },
        { "Username": identifier }
      ]
    });

    console.log('User:', user);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValidPassword = await bcrypt.compare(password, user.Password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}




export function getAll(req, res) {
    // Retrieve all tests from the database
    user.find()
        .then((users) => {
            // Respond with the array of tests
            res.json(users);
        })
        .catch((err) => {
            // Respond with 500 Internal Server Error and the error details
            res.status(500).json({ error: err });
        });
}

export function banUser(req, res) {
    // Check if there are validation errors
    if (!validationResult(req).isEmpty()) {
        // Respond with 400 Bad Request and the validation errors
        return res.status(400).json({ errors: validationResult(req).array() });
    } else {
        // If there are no validation errors, update the user by ID
        user.findByIdAndUpdate(
            req.params.id,
            {
                Banned:req.body.banned,
            },
            { new: true } // Return the updated user
        )
            .then((bannedUser) => {
                // Check if the user exists
                if (!bannedUser) {
                    return res.status(404).json({ message: 'user not found' });
                }
                // Respond with the updated user details
                res.json({
                    message:'user banned  successfully'
                });
            })
            .catch((err) => {
                // Respond with 500 Internal Server Error and the error details
                res.status(500).json({ error: err });
            });
    }
}
export function unbanUser(req, res) {
    // Check if there are validation errors
    if (!validationResult(req).isEmpty()) {
        // Respond with 400 Bad Request and the validation errors
        return res.status(400).json({ errors: validationResult(req).array() });
    } else {
        // If there are no validation errors, update the user by ID
        user.findByIdAndUpdate(
            req.params.id,
            {
                Banned:false,
            },
            { new: true } // Return the updated user
        )
            .then((bannedUser) => {
                // Check if the user exists
                if (!bannedUser) {
                    return res.status(404).json({ message: 'user not found' });
                }
                // Respond with the updated user details
                res.json({
                    message:'user unbanned  successfully'
                });
            })
            .catch((err) => {
                // Respond with 500 Internal Server Error and the error details
                res.status(500).json({ error: err });
            });
    }
}

async function createchildinblockchain(){
    
    console.log('- Creating a new account...\n');
    const privateKey = PrivateKey.generateECDSA();
      console.log("private"+privateKey);
    const publicKey = privateKey.publicKey;
    // Assuming that the target shard and realm are known.
    // For now they are virtually always 0 and 0.
    const aliasAccountId = publicKey.toAccountId(0, 0);
    console.log(`- New account ID: ${aliasAccountId.toString()}`);
    if (aliasAccountId.aliasKey === null) {
        throw new Error('alias key is empty');
    }
    console.log(`- Just the aliasKey: ${aliasAccountId.aliasKey.toString()}\n`);
    /**
     * Step 4
     *
     * Transfer the fungible token to the public key alias
     */
    console.log('- Transferring the fungible tokens...\n');
    await sendToken(client, tokenId, operatorAccountId, aliasAccountId, 1, operatorPrivateKey);
    /**
     * Step 5
     *
     * Return the new account ID in the child record
     */
    const accountId =await getAccountIdByAlias(client, aliasAccountId);
    console.log(`The normal account ID of the given alias: ${accountId}`);
    /**
   * Step 6
   *
   * Show the new account ID owns the fungible token
   */
    const accountBalances = await new AccountBalanceQuery()
        .setAccountId(aliasAccountId)
        .execute(client);
    if (!accountBalances.tokens || !accountBalances.tokens._map) {
        throw new Error('account balance shows no tokens.');
    }
    const tokenBalanceAccountId = accountBalances.tokens._map
        .get(tokenId.toString());
    if (!tokenBalanceAccountId) {
        throw new Error(`account balance does not have tokens for token id: ${tokenId}.`);
    }
    tokenBalanceAccountId.toInt() === 10
        ? console.log(`Account is created successfully using HTS 'TransferTransaction'`)
        : console.log("Creating account with HTS using public key alias failed");
    return { privateKey ,accountId };
}


// Function to create a new child user
export  async function createChild(req, res) {
    const child = req.body;
    child.Role="child"
    try {
      const {privateKey, accountId} =  await  createchildinblockchain();
      
      child.Adressblockchain = accountId.toString();
        const childcreated = await User.create(child);
        console.log(childcreated)
      const key =  await transformString(childcreated.Username);
       const encrypted = encryptText(privateKey,key);
       console.log(encrypted)
       const decrypted = decryptText(encrypted.encryptedText,encrypted.iv,key);
        res.json({
            key:key,
            encrypted:encrypted.encryptedText,
            privatekey:privateKey.toString(),
            decrypted :decrypted
        });
   
    } catch (error) {
        throw new Error('Error creating child user');
    }
}

// Function to get all children by parent ID
export  async function getAllChildrenByParentId(req, res) {
    try {
        const children = await User.find({ Parentid: req.params.parentid, Role: 'child' });
      
        res.json(children)
    } catch (error) {
        throw new Error('Error fetching children');
    }
}

// Function to get all children
export async function getAllChildren(req, res) {
    try {
        const children = await User.find({ Role: 'child' });
        res.json(children)
    } catch (error) {
        throw new Error('Error fetching children');
    }
}

// Function to delete a child by ID
export async function deleteChildById(req, res) {
    try {
        const deletedChild = await User.findByIdAndDelete(req.body.childId);
        res.json(deletedChild)
    } catch (error) {
        throw new Error('Error deleting child');
    }
}
async function getAccountIdByAlias (client, aliasAccountId){
    const accountInfo = await new AccountInfoQuery()
        .setAccountId(aliasAccountId)
        .execute(client);
    console.log("accountinfo:" + accountInfo);
    return accountInfo.accountId;
}
async function sendToken(client, tokenId, owner, aliasAccountId, sendBalance, treasuryAccPvKey) {
    const tokenTransferTx = new TransferTransaction()
        .addTokenTransfer(tokenId, owner, -sendBalance)
        .addTokenTransfer(tokenId, aliasAccountId, sendBalance)
        .freezeWith(client);
     
    // Sign the transaction with the operator key
    let tokenTransferTxSign = await tokenTransferTx.sign(treasuryAccPvKey);
    // Submit the transaction to the Hedera network
    let tokenTransferSubmit = await tokenTransferTxSign.execute(client);
    // Get transaction receipt information
    await tokenTransferSubmit.getReceipt(client);
}
async function transformString(input) {
    if (input.length <= 6) {
        return input; // If the input length is 6 or less, return the input as is
    }
try {
   

    let middleIndex = Math.floor(input.length / 2);
    
    // Find the index of the middle character
    let transformedString = 'a'; // Initialize the transformed string
    
    // Add the characters according to the specified pattern
    transformedString += input[middleIndex];
    transformedString += 'za'
    transformedString += input[middleIndex + 2];
    transformedString += 'bz'
    middleIndex = middleIndex +2;
    transformedString += input[middleIndex - 3];
    transformedString += 'xb'
    middleIndex = middleIndex -3;
    transformedString += input[middleIndex - 1];
    transformedString += 'cx'
    
    transformedString += input[input.length - 1];
    transformedString += 'uc'
    transformedString += input[input.length - 2];
    transformedString += input[1];
    transformedString += 'du'
    transformedString += input[middleIndex+1];
    transformedString += 'qd'
    transformedString += input[0];
    transformedString += 'eq'
    if (input.length >= 10) {

       transformedString += input[middleIndex+2];
    transformedString += 'le'
    transformedString += input[middleIndex+3];
    transformedString += 'fl' 
    transformedString += input[middleIndex+1];// If the input length is 6 or less, return the input as is
    }
   

    // Add characters from the alphabet in the specified pattern
 

    return transformedString;
} catch (error) {
    console.log(error)
}
}
function encryptText(text, key) {
    try{
      let  keybytes = Buffer.from(key, 'utf-8');
      console.log(keybytes.length);
        if (keybytes.length > 32) {
            // Truncate the key if it's longer than 32 bytes
           keybytes= keybytes.subarray(0, 32);
        } else if (keybytes.length < 32) {
            // Pad the key with null bytes if it's shorter than 32 bytes
           keybytes =  key.padEnd(32, '\0');
        } 
       
   //     const data =  Buffer.from(text);
    const iv = randomBytes(16); // Generate a random initialization vector
    const cipher = createCipheriv('aes-256-cbc', keybytes, iv);
    let encryptedText = cipher.update(text.toString(), 'utf8', 'hex');
    encryptedText += cipher.final('hex');
    return { iv: iv.toString('hex'), encryptedText };
    }catch(error){
        console.log(error)
    }
}

// Function to decrypt an encrypted string using a key and initialization vector (iv)
function decryptText(encryptedText, iv, key) {
  let  keybytes = Buffer.from(key, 'utf-8');
    if (keybytes.length > 32) {
        // Truncate the key if it's longer than 32 bytes
      keybytes=  keybytes.subarray(0, 32);
    } else if (keybytes.length < 32) {
        // Pad the key with null bytes if it's shorter than 32 bytes
       keybytes =  key.padEnd(32, '\0');
    } 
    const decipher = createDecipheriv('aes-256-cbc', keybytes, Buffer.from(iv, 'hex'));
    let decryptedText = decipher.update(encryptedText, 'hex', 'utf8');
    decryptedText += decipher.final('utf8');
    return decryptedText;
}