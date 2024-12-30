#!/usr/bin/env bash
##
# Generates new keys/certificates.
#
# Please consider carefully before running this again.
# The certificates generated by this script are already
# set as trusted by those working on Clever Canyon products.
##

cd "$(dirname "${BASH_SOURCE[0]}")" || { echo 'CD failure.' >&2 && exit 1; }
. ../../../../node_modules/@clevercanyon/utilities.bash/dist/load.bash || { echo 'Load failure.' >&2 && exit 1; }

# Configuration of SSL certs.
# A few variables for CLI args below.

output_dir=. # Current directory.
days=395     # {@see https://o5p.me/Fz1NWM}.

key_usages=$(
    tr -d '\n' <<- 'ooo'
	digitalSignature,
	nonRepudiation,
	keyEncipherment,
	dataEncipherment,
	keyAgreement,
	keyCertSign,
	cRLSign
	ooo
)
extended_key_usages=$(
    tr -d '\n' <<- 'ooo'
	serverAuth,
	clientAuth,
	codeSigning,
	emailProtection,
	anyExtendedKeyUsage
	ooo
)
root_subject=$(
    tr -d '\n' <<- 'ooo'
	/L=Auburn
	/ST=ME
	/C=US
	/O=Clever Canyon
	/OU=Engineering
	/CN=root.clevercanyon.com
	/emailAddress=admin@clevercanyon.com
	ooo
)
i10e_subject=$(
    tr -d '\n' <<- 'ooo'
	/L=Auburn
	/ST=ME
	/C=US
	/O=Clever Canyon
	/OU=Engineering
	/CN=clevercanyon.com
	/emailAddress=admin@clevercanyon.com
	ooo
)
# Aside from `*.local`, `*.localhost`, browsers don’t acknowledge `*.tld`, because that would effectively cover
# everything on an entire TLD. That’s why we also have `*.x.[tld]`. See: <https://o5p.me/YPcyex> for further details.
subject_alt_names=$(
    tr -d '\n' <<- 'ooo'
	IP:::,
	IP:0.0.0.0,

	IP:::1,
	IP:127.0.0.1,

	DNS:*.mac,
	DNS:*.x.mac,

	DNS:*.loc,
	DNS:*.x.loc,

	DNS:*.dkr,
	DNS:*.x.dkr,

	DNS:*.vm,
	DNS:*.x.vm,

	DNS:local,
	DNS:*.local,
	DNS:*.x.local,

	DNS:localhost,
	DNS:*.localhost,
	DNS:*.x.localhost,

	DNS:clevercanyon.com,
	DNS:*.clevercanyon.com,

	DNS:hop.gdn,
	DNS:*.hop.gdn,

	DNS:o5p.me,
	DNS:*.o5p.me
	ooo
)
# Start clean each time.

rm -f ./openssl/store/certs/*
rm -f ./openssl/store/certs-db
rm -f ./openssl/store/certs-db.*
rm -f ./openssl/store/serial-db
rm -f ./openssl/store/serial-db.*

if [[ ! -d "${output_dir}" ]]; then mkdir -p "${output_dir}"; fi
if [[ ! -d ./openssl/store/certs ]]; then mkdir -p ./openssl/store/certs; fi
touch ./openssl/store/certs-db

# Root self-signed & intermediate CA keys.

openssl genrsa -out "${output_dir}"/root-ca-key.pem 4096
openssl genrsa -out "${output_dir}"/i10e-ca-key.pem 4096

# Root self-signed CA certificate.

openssl req -config ./openssl/config.ini \
    -new \
    -nodes \
    -sha512 \
    -key "${output_dir}"/root-ca-key.pem \
    -out "${output_dir}"/root-ca-csr.pem \
    -subj "${root_subject}" -addext 'subjectAltName = '"${subject_alt_names}" \
    -addext 'keyUsage = '"${key_usages}" -addext 'extendedKeyUsage = '"${extended_key_usages}"

openssl ca -config ./openssl/config.ini -extensions v3_root_ca \
    -selfsign \
    -notext \
    -batch \
    -md sha512 \
    -rand_serial \
    -days "${days}" \
    -keyfile "${output_dir}"/root-ca-key.pem \
    -in "${output_dir}"/root-ca-csr.pem \
    -out "${output_dir}"/root-ca-crt.pem

# Intermediate CSR & CA certificate.

openssl req -config ./openssl/config.ini \
    -new \
    -nodes \
    -sha512 \
    -key "${output_dir}"/i10e-ca-key.pem \
    -out "${output_dir}"/i10e-ca-csr.pem \
    -subj "${i10e_subject}" -addext 'subjectAltName = '"${subject_alt_names}" \
    -addext 'keyUsage = '"${key_usages}" -addext 'extendedKeyUsage = '"${extended_key_usages}"

openssl ca -config ./openssl/config.ini -extensions v3_i10e_ca \
    -notext \
    -batch \
    -md sha512 \
    -rand_serial \
    -days "${days}" \
    -cert "${output_dir}"/root-ca-crt.pem \
    -keyfile "${output_dir}"/root-ca-key.pem \
    -in "${output_dir}"/i10e-ca-csr.pem \
    -out "${output_dir}"/i10e-ca-crt.pem
